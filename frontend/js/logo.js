const MAJIMONITOR_LOGO_SVG = `
<svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <clipPath id="dropClip">
            <path d="M20 3 C20 3 8 18 8 26 C8 33.7 13.4 38 20 38 C26.6 38 32 33.7 32 26 C32 18 20 3 20 3 Z"/>
        </clipPath>
    </defs>
    <path d="M20 3 C20 3 8 18 8 26 C8 33.7 13.4 38 20 38 C26.6 38 32 33.7 32 26 C32 18 20 3 20 3 Z"
          fill="#DCE9E8" stroke="#2F5D62" stroke-width="1.5"/>
    <g clip-path="url(#dropClip)">
        <path class="logo-wave" d="M6 24 Q 12 20, 18 24 T 30 24 T 42 24 V40 H6 Z" fill="#2F5D62" opacity="0.85"/>
        <path class="logo-wave logo-wave-2" d="M6 27 Q 12 23, 18 27 T 30 27 T 42 27 V40 H6 Z" fill="#6FA8AE" opacity="0.7"/>
    </g>
</svg>
`;

function insertLogo() {
    document.querySelectorAll('.sidebar-brand-icon').forEach(el => {
        el.innerHTML = MAJIMONITOR_LOGO_SVG;
    });
}

insertLogo();