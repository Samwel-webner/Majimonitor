// Animal avatars for the web app. The database stores the key (e.g. "lion").
// Keep this list in step with backend/config/avatars.js and mobile/utils/avatars.ts.
(function () {
    var COLORS = ['#DCE9E8', '#E5EDE3', '#E4E2F2', '#DDEBF5', '#F1E7DA'];
    var ANIMALS = [
        { key: 'lion', emoji: '🦁', label: 'Lion' },
        { key: 'elephant', emoji: '🐘', label: 'Elephant' },
        { key: 'giraffe', emoji: '🦒', label: 'Giraffe' },
        { key: 'zebra', emoji: '🦓', label: 'Zebra' },
        { key: 'rhino', emoji: '🦏', label: 'Rhino' },
        { key: 'leopard', emoji: '🐆', label: 'Leopard' },
        { key: 'crocodile', emoji: '🐊', label: 'Crocodile' },
        { key: 'eagle', emoji: '🦅', label: 'Eagle' },
        { key: 'owl', emoji: '🦉', label: 'Owl' },
        { key: 'monkey', emoji: '🐒', label: 'Monkey' },
        { key: 'fox', emoji: '🦊', label: 'Fox' },
        { key: 'turtle', emoji: '🐢', label: 'Turtle' },
        { key: 'frog', emoji: '🐸', label: 'Frog' },
        { key: 'fish', emoji: '🐟', label: 'Fish' },
        { key: 'duck', emoji: '🦆', label: 'Duck' },
        { key: 'dolphin', emoji: '🐬', label: 'Dolphin' }
    ];
    ANIMALS.forEach(function (a, i) { a.bg = COLORS[i % COLORS.length]; });

    // The chosen animal, or an automatic one based on the user id.
    function forUser(userId, key) {
        for (var i = 0; i < ANIMALS.length; i++) {
            if (ANIMALS[i].key === key) return ANIMALS[i];
        }
        return ANIMALS[Math.abs(Number(userId) || 0) % ANIMALS.length];
    }

    // HTML for a round animal avatar.
    function html(userId, key, size) {
        var a = forUser(userId, key);
        size = size || 40;
        return '<span class="avatar" role="img" aria-label="' + a.label + '" style="width:' + size +
            'px;height:' + size + 'px;font-size:' + Math.round(size * 0.55) + 'px;background:' + a.bg + '">' +
            a.emoji + '</span>';
    }

    window.MajiAvatar = { list: ANIMALS, forUser: forUser, html: html };
})();