use wasm_bindgen::prelude::*;
use web_sys::{DomParser, Document, Element, Node};
use zip::{write::FileOptions, ZipWriter};
use std::io::{Cursor, Write};
use regex::Regex;
use lazy_static::lazy_static;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// --- Data Structures ---
struct Interaction {
    query: String,
    timestamp: String,
    response_parts: Vec<ResponsePart>,
}

struct ResponsePart {
    part_type: String,
    content: String,
}

// --- Main Exposed Function ---
#[wasm_bindgen]
pub fn process_activity_html(html_string: &str) -> Result<Vec<u8>, JsValue> {
    console_error_panic_hook::set_once();

    let interactions = parse_html(html_string)?;
    let organized_content = organize_content(interactions);
    let zip_data = create_zip(organized_content)?;

    Ok(zip_data)
}

// --- 1. Parsing Logic ---
fn parse_html(html_string: &str) -> Result<Vec<Interaction>, JsValue> {
    let parser = DomParser::new()?;
    let doc = parser.parse_from_string(html_string, "text/html")?;
    let mut interactions = Vec::new();

    let interaction_elements = doc.query_selector_all("div.outer-cell.mdl-cell.mdl-cell--12-col.mdl-shadow--2dp")?;

    for i in 0..interaction_elements.length() {
        if let Some(element_node) = interaction_elements.item(i) {
            let element = Element::from(element_node);
            if let Ok(Some(interaction)) = process_interaction_element(&element) {
                interactions.push(interaction);
            }
        }
    }
    Ok(interactions)
}

fn process_interaction_element(element: &Element) -> Result<Option<Interaction>, JsValue> {
    let main_content_cell = match element.query_selector("div.content-cell.mdl-cell.mdl-cell--6-col.mdl-typography--body-1")? {
        Some(cell) => cell,
        None => return Ok(None),
    };

    let mut query = String::new();
    let mut timestamp = String::from("Unknown_Time");
    let mut response_parts = Vec::new();

    let mut response_start_node: Option<Node> = None;
    let mut prompt_parts = Vec::new();

    let child_nodes = main_content_cell.child_nodes();
    for i in 0..child_nodes.length() {
        if let Some(node) = child_nodes.item(i) {
            if node.node_name().eq_ignore_ascii_case("BR") {
                 if let Some(next_sibling) = node.next_sibling() {
                    if next_sibling.node_type() == Node::TEXT_NODE {
                        if let Some(text_content) = next_sibling.text_content() {
                            let trimmed_text = text_content.trim();
                            if is_timestamp(trimmed_text) {
                                timestamp = trimmed_text.to_string();
                                response_start_node = next_sibling.next_sibling();
                                break;
                            }
                        }
                    }
                }
            }
            prompt_parts.push(node.text_content().unwrap_or_default());
        }
    }

    let prompt_text = prompt_parts.join("").trim().to_string();
    query = prompt_text.strip_prefix("Prompted ").unwrap_or(&prompt_text).to_string();

    if let Some(start_node) = response_start_node {
        let mut current_node = Some(start_node);
        while let Some(node) = current_node {
            if node.node_type() == Node::ELEMENT_NODE {
                let elem = Element::from(node.clone());
                let tag_name = elem.tag_name().to_lowercase();
                 if let Some(text) = elem.text_content() {
                    if !text.to_lowercase().contains("explore related topics") && elem.query_selector("button")?.is_none() {
                        if tag_name == "pre" {
                            response_parts.push(ResponsePart { part_type: "code_block".to_string(), content: text.trim().to_string() });
                        } else if ["p", "div", "ul", "ol", "table"].contains(&tag_name.as_str()) {
                            if !text.trim().is_empty() {
                                response_parts.push(ResponsePart { part_type: "prose".to_string(), content: text.trim().to_string() });
                            }
                        }
                    }
                }
            } else if node.node_type() == Node::TEXT_NODE {
                 if let Some(text) = node.text_content() {
                     if !text.trim().is_empty() {
                        response_parts.push(ResponsePart { part_type: "prose".to_string(), content: text.trim().to_string() });
                     }
                 }
            }
            current_node = node.next_sibling();
        }
    }

    if query.is_empty() && response_parts.is_empty() {
        return Ok(None);
    }

    Ok(Some(Interaction { query, timestamp, response_parts }))
}

fn is_timestamp(text: &str) -> bool {
    lazy_static! {
        static ref RE: Regex = Regex::new(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)(?:\s+[A-Z]{3})?").unwrap();
    }
    RE.is_match(text)
}


// --- 2. Organization Logic ---
fn organize_content(interactions: Vec<Interaction>) -> Vec<(String, String)> {
    let mut file_list = Vec::new();
    for (i, interaction) in interactions.iter().enumerate() {
        let safe_ts = interaction.timestamp.replace(|c: char| !c.is_alphanumeric(), "_");
        let safe_query = sanitize_filename(&interaction.query, 50);
        let base_filename = format!("{}_{}_{}", safe_ts, i, safe_query);

        if !interaction.query.is_empty() {
            file_list.push((format!("prompts/{}_prompt.txt", base_filename), interaction.query.clone()));
        }

        for (j, part) in interaction.response_parts.iter().enumerate() {
            let structures = detect_structures(&part.content);
            let dir = get_directory(&structures);
            let ext = get_file_extension(&structures);
            let filename = format!("{}/{}_response_{}{}", dir, base_filename, j, ext);
            file_list.push((filename, part.content.clone()));
        }
    }
    file_list
}

fn sanitize_filename(text: &str, max_length: usize) -> String {
    let sanitized: String = text
        .to_lowercase()
        .replace(char::is_whitespace, "_")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-')
        .collect();

    if sanitized.len() > max_length {
        sanitized.chars().take(max_length).collect()
    } else if sanitized.is_empty() {
        "unnamed".to_string()
    } else {
        sanitized
    }
}

fn detect_structures(text: &str) -> Vec<String> {
    let mut structures = Vec::new();
    if text.contains("def ") && text.contains(":") { structures.push("python".to_string()); }
    if text.contains("function") && text.contains("{") { structures.push("javascript".to_string()); }
    if text.contains("```") { structures.push("markdown".to_string()); }
    structures
}

fn get_directory(structures: &[String]) -> &str {
    if structures.contains(&"python".to_string()) { "python" }
    else if structures.contains(&"javascript".to_string()) { "javascript" }
    else if structures.contains(&"markdown".to_string()) { "markdown" }
    else { "text" }
}

fn get_file_extension(structures: &[String]) -> &str {
    if structures.contains(&"python".to_string()) { ".py" }
    else if structures.contains(&"javascript".to_string()) { ".js" }
    else if structures.contains(&"markdown".to_string()) { ".md" }
    else { ".txt" }
}

// --- 3. Zipping Logic ---
fn create_zip(file_list: Vec<(String, String)>) -> Result<Vec<u8>, JsValue> {
    let mut buffer = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buffer);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        for (path, content) in file_list {
            zip.start_file(path, options).map_err(|e| JsValue::from_str(&e.to_string()))?;
            zip.write_all(content.as_bytes()).map_err(|e| JsValue::from_str(&e.to_string()))?;
        }
        zip.finish().map_err(|e| JsValue::from_str(&e.to_string()))?;
    }

    Ok(buffer.into_inner())
}