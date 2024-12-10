use printpdf::*;
use textwrap::wrap;
use std::fs::File;
use std::io::BufWriter;
use std::error::Error;

use qrcode::QrCode;
use qrcode::types::Color;

use crate::paper::PaperWallet;

pub fn generate_and_save_pdf(wallets: &Vec<PaperWallet>, exclude: Option<Vec<String>>, include_birthday: bool, filename: &str) -> Result<String, Box<dyn Error>> {
    let (doc, page1, layer1) = PdfDocument::new("Zcash Paper Wallet", Mm(210.0), Mm(297.0), "Layer 1");    
    let font = doc.add_builtin_font(BuiltinFont::Courier)
        .map_err(|_| "Error loading built-in font")?;

    let font_bold = doc.add_builtin_font(BuiltinFont::CourierBold)
        .map_err(|_| "Error loading built-in font")?;

    let mut current_layer = doc.get_page(page1).get_layer(layer1);
   
    // Position on the PDF page.
    let mut pos = 0;
    
    // let total_pages      = f32::ceil(1 as f32 / 2.0);   // 2 per page
    let mut current_page = 1;
    
    for w in wallets {
        // Add next page when moving to the next position.
        if pos >= 1 {
            pos = 0;
            current_page = current_page + 1;

            // Add a page
            let (page2, _) = doc.add_page(Mm(210.0), Mm(297.0),"Page 2, Layer 1");
            current_layer = doc.get_page(page2).add_layer("Layer 3");
        }
        
        let ua = w.get_unified_address(exclude.clone().unwrap_or_default());
        let ufvk = w.get_ufvk();
        let seed = w.get_seed_phrase();
        let birthday = if include_birthday {
            Some(w.get_estimated_birthday())
        } else {
            None
        };

        add_address_to_page(&current_layer, &font, &font_bold, ua.clone());
        add_ufvk_to_page(&current_layer, &font, &font_bold, ufvk.clone());
        add_seed_to_page(&current_layer, &font, &font_bold, seed, ua.clone(), birthday);
        add_page_separator(&current_layer);
        pos = pos + 1;        
    }
    
    doc.save(
        &mut BufWriter::new(
            File::create(filename)
            .map_err(|_| "An error occoured while saving the PDF file.")?
        )
    )?;
    Ok(filename.to_string())
}

fn add_address_to_page(current_layer: &PdfLayerReference, font: &IndirectFontRef, font_bold: &IndirectFontRef, ua: String) {
    let ypos = 297.0 - 49.5;
    
    current_layer.use_text("Zcash Unified Address", 14.0, Mm(10.0), Mm(ypos+16.0), &font_bold);
    
    let strs = wrap(&ua.as_str(), 50);
    for (i, line) in strs.iter().enumerate() {
        let y_position = 4.0 + ypos - (i as f32 * 5.0); // Adjust for line spacing
        current_layer.use_text(line.to_string(), 12.0, Mm(10.0), Mm(y_position), &font);
    }
    
    let (scaledimg, finalsize) = qrcode_scaled(&ua.as_str(), 10);
    add_qrcode_image_to_page(current_layer, &scaledimg, finalsize, Mm(145.0), Mm(ypos-28.0));
}

fn add_ufvk_to_page(current_layer: &PdfLayerReference, font: &IndirectFontRef, font_bold: &IndirectFontRef, ufvk: String) {
    let ypos = 297.0 - 130.0;
    
    current_layer.use_text("Unified Full Viewing Key", 14.0, Mm(84.0), Mm(ypos+16.0), &font_bold);
    
    let strs = wrap(&ufvk.as_str(), 44);
    for (i, line) in strs.iter().enumerate() {
        let y_position = 4.0 + ypos - (i as f32 * 5.0); // Adjust for line spacing
        current_layer.use_text(line.to_string(), 12.0, Mm(84.0), Mm(y_position), &font);
    }
    
    let (scaledimg, finalsize) = qrcode_scaled(&ufvk.as_str(), 9);
    add_qrcode_image_to_page(current_layer, &scaledimg, finalsize, Mm(10.0), Mm(ypos-54.0));
}

fn add_seed_to_page(current_layer: &PdfLayerReference, font: &IndirectFontRef, font_bold: &IndirectFontRef, seed: &str, ua: String, birthday: Option<u32>) {   
    let ypos = 99.0 - 12.0;
   
    let (scaledimg, finalsize) = qrcode_scaled(seed, 13);
    add_qrcode_image_to_page(current_layer, &scaledimg, finalsize, Mm(135.0), Mm(ypos-65.0));

    current_layer.use_text("Mnemonic phrase", 14.0, Mm(10.0), Mm(ypos), &font_bold);
    
    let strs = wrap(&seed, 45);
    for (i, line) in strs.iter().enumerate() {
        let y_position = ypos - 10.0 - (i as f32 * 5.0); // Adjust for line spacing
        current_layer.use_text(line.to_string(), 12.0, Mm(10.0), Mm(y_position), &font);
    }

    // Add the address a second time below the mnemonic phrase
    current_layer.use_text("Zcash Unified Address", 12.0, Mm(10.0), Mm(ypos-35.0), &font_bold);    
    let strs = wrap(&ua, 50);
    for (i, line) in strs.iter().enumerate() {
        let y_position = ypos - 40.0 - (i as f32 * 4.0); // Adjust for line spacing
        current_layer.use_text(line.to_string(), 10.0, Mm(10.0), Mm(y_position), &font);
    }

    // Add the wallet estimated birthday
    if birthday.is_some() {
        current_layer.use_text("Wallet birthday", 12.0, Mm(10.0), Mm(ypos-65.0), &font_bold);
        current_layer.use_text(birthday.unwrap().to_string(), 10.0, Mm(10.0), Mm(ypos-72.0), &font);
    }    
}

fn qrcode_scaled(data: &str, scalefactor: usize) -> (Vec<u8>, usize) {
    let code = QrCode::new(data.as_bytes()).unwrap();
    let output_size = code.width();

    let imgdata = code.to_colors();

    // Add padding around the QR code, otherwise some scanners can't seem to read it. 
    let padding     = 10;
    let scaledsize  = output_size * scalefactor;
    let finalsize   = scaledsize + (2 * padding);

    // Build a scaled image
    let scaledimg: Vec<u8> = (0..(finalsize*finalsize)).flat_map( |i| {
        let x = i / finalsize;
        let y = i % finalsize;
        if x < padding || y < padding || x >= (padding+scaledsize) || y >= (padding+scaledsize) {
            vec![255u8; 3]
        } else {
            if imgdata[(x - padding)/scalefactor * output_size + (y - padding)/scalefactor] != Color::Light {vec![0u8; 3] } else { vec![255u8; 3] }
        }
    }).collect();

    return (scaledimg, finalsize);
}

fn add_qrcode_image_to_page(current_layer: &PdfLayerReference, qr: &Vec<u8>, qrsize: usize, x: Mm, y: Mm) {
    // you can also construct images manually from your data:
    let image_file_2 = ImageXObject {
            width: Px(qrsize),
            height: Px(qrsize),
            color_space: ColorSpace::Rgb,
            bits_per_component: ColorBits::Bit8,
            interpolate: true,
            /* put your bytes here. Make sure the total number of bytes =
            width * height * (bytes per component * number of components)
            (e.g. 2 (bytes) x 3 (colors) for RGB 16bit) */
            image_data: qr.to_vec(),
            image_filter: None, /* does not work yet */
            clipping_bbox: None, /* doesn't work either, untested */
            smask: None
    };
    
    let image2 = Image::from(image_file_2);
    image2.add_to_layer(current_layer.clone(), ImageTransform { translate_x: Some(x), translate_y: Some(y), rotate: None, scale_x: None, scale_y: None, dpi: None });
}

fn add_page_separator(current_layer: &PdfLayerReference) {
    let line1 = Line {
        points: vec![(Point::new(Mm(5.0), Mm(99.0)), false), (Point::new(Mm(205.0), Mm(99.0)), false)],
        is_closed: true,
    };

    let line2 = Line {
        points: vec![(Point::new(Mm(5.0), Mm(198.0)), false), (Point::new(Mm(205.0), Mm(198.0)), false)],
        is_closed: true,
    };

    let outline_color = printpdf::Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None));
    current_layer.set_outline_color(outline_color);
    let mut dash_pattern = LineDashPattern::default();
    dash_pattern.dash_1 = Some(5);
    current_layer.set_line_dash_pattern(dash_pattern);
    current_layer.set_outline_thickness(1.0);

    // Draw separator line
    current_layer.add_line(line1);
    current_layer.add_line(line2);
}