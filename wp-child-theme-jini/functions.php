<?php
/**
 * Newspaper Child Theme - JINI AI Integration
 * functions.php
 *
 * Integrasi JINI AI inline panel di bawah navigation menu Newspaper/tagDiv.
 * 
 * Struktur:
 *   1. CSS dimuat via wp_head (jini-inline.css)
 *   2. HTML panel disisipkan di header.php child theme setelah </nav>
 *   3. JavaScript dimuat via wp_footer
 *   4. Shortcode [jini_ai_panel] untuk penempatan manual di widget atau content
 */

if (!defined('ABSPATH')) exit;

/**
 * 1. Enqueue parent theme (Newspaper) stylesheet
 */
add_action('wp_enqueue_scripts', 'newspaper_child_jini_enqueue_styles');
function newspaper_child_jini_enqueue_styles() {
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
}

/**
 * 2. Load JINI inline CSS dari file child theme ke wp_head
 */
add_action('wp_head', 'newspaper_child_jini_load_css', 100);
function newspaper_child_jini_load_css() {
    $css_file = get_stylesheet_directory() . '/jini-inline.css';
    if (file_exists($css_file)) {
        $css = file_get_contents($css_file);
        echo '<style id="jini-inline-css">' . "\n" . $css . "\n" . '</style>' . "\n";
    }
}

/**
 * 3. Load JINI inline JavaScript dari file child theme ke wp_footer
 *    HTML panel sudah diletakkan di header.php, jadi hanya enqueue JS saja
 */
add_action('wp_footer', 'newspaper_child_jini_load_script', 999);
function newspaper_child_jini_load_script() {
    if (is_admin()) return;
    
    // Load JavaScript untuk JINI chat functionality
    $js_file = get_stylesheet_directory() . '/jini-chat-inline.js';
    if (file_exists($js_file)) {
        wp_enqueue_script('jini-inline-js', get_stylesheet_directory_uri() . '/jini-chat-inline.js', array(), '1.0.0', true);
    }
}

/**
 * 4. Shortcode [jini_ai_panel] untuk penempatan manual di widget atau content
 *    Gunakan shortcode ini jika ingin panel ditempatkan di tempat lain (di dalam konten, widget, dll)
 */
add_shortcode('jini_ai_panel', 'newspaper_child_jini_shortcode');
function newspaper_child_jini_shortcode() {
    ob_start();
    $embed_file = get_stylesheet_directory() . '/jini-embed.php';
    if (file_exists($embed_file)) {
        include $embed_file;
    }
    $output = ob_get_clean();
    return $output;
}