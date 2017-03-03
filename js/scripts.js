jQuery(function($) {

    /* ============================================================ */
    /* Responsive Videos */
    /* ============================================================ */

    $(".post-content").fitVids();

    /* ============================================================ */
    /* Scroll To Top */
    /* ============================================================ */

    $('.js-jump-top').on('click', function(e) {
        e.preventDefault();

        $('html, body').animate({'scrollTop': 0});
    });
});

/* removed highlight.js initialize function since we use pymentize */
