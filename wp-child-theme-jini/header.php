<?php
/**
 * Header template for Newspaper Child Theme with JINI AI Inline Panel
 * 
 * Positions JINI AI panel directly below navigation menu (HOME, POLITIK, WORLD, LAW, EKON, etc.)
 * 
 * @package Newspaper Child
 */

if (!defined('ABSPATH')) exit; ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
   <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<header id="masthead" class="site-header">

   <?php
   // Display primary navigation menu
   // Newspaper theme theme_location: 'header'
   wp_nav_menu( array(
       'theme_location' => 'header',
       'container'      => 'nav',
       'container_class'=> 'main-navigation',
       'menu_class'     => 'nav-menu',
       'fallback_cb'    => '',
   ) );
   ?>

   <!-- JINI AI Inline Panel - directly below navigation menu -->
   <div id="jini-chat-inline">
       <div id="jini-chat-panel-inline">
           <div id="jini-panel-header-inline">
               <div id="jini-panel-title-inline">
                   <div id="jini-panel-icon-inline">J</div>
                   <span>JINI AI</span>
               </div>
           </div>
           <div id="jini-messages-inline"></div>
           <div id="jini-input-area-inline">
               <input type="text" id="jini-input-inline" placeholder="Ketik pertanyaan Anda..." autocomplete="off">
               <button id="jini-send-btn-inline" aria-label="Kirim pesan">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <line x1="22" y1="2" x2="11" y2="13"></line>
                       <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                   </svg>
               </button>
           </div>
       </div>
   </div>
   <!-- End JINI AI Inline Panel -->

</header>

<!-- Note: JavaScript enqueued via functions.php wp_footer (jini-chat-inline.js)
     CSS enqueued via functions.php wp_head (jini-inline.css)
     Panel HTML: already in header.php above, below </nav>
-->
</body>
</html>
