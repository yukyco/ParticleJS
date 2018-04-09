/**
 * requestAnimationFrame
 */
window.requestAnimationFrame = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function (callback) { window.setTimeout(callback, 1000 / 60); };
})();


/**
 * ElasticString
 */
var ElasticString = (function(document) {

    'use strict';

    /**
     * @constructor
     */
    function ElasticString(fontSize, fontFamily, friction, spring) {
        this._fontSize = fontSize;
        this.points = [];
        this.fontFamily = fontFamily || 'serif';
        if (friction !== undefined) this.friction = friction;
        if (spring !== undefined) this.spring = spring;

        // 最後のテキストポイントの補完ポイント
        this._endPoint = new Point();

        // フォントサイズ
        this._ctx = document.createElement('canvas').getContext('2d');
    }

    ElasticString.prototype = {
        points: null,
        fontFamily: 'serif',
        friction: 0.02,
        spring: 0.6,
        _text: '',
        _fontSize: 1,
        _endPoint: null,

        setFontSize: function(fontSize) {
            this._fontSize = fontSize;
            this.setText(this._text);
        },

        getFontSize: function() { return this._fontSize; },

        setText: function(text, positions) {
            var points = this.points,
                p, letter, between,
                i, len;

            if (text.length < points.length) {
                points = points.slice(0, text.length);
            }

            this._ctx.font = this._fontSize + 'px ' + this.fontFamily;

            for (i = 0, len = text.length; i < len; i++) {
                letter = text.charAt(i);
                between = this._ctx.measureText(letter).width;

                p = points[i];
                if (p) {
                    p.letter = letter;
                    p.between = between;
                } else {
                    p = new Point(letter, between);
                    points[i] = p;
                }

                if (positions && positions.length) {
                    p.x = p.px = positions[i][0];
                    p.y = p.py = positions[i][1];
                }
            }

            this.points = points;
            this._text = text;
        },

        getText: function() { return this._text; },

        render: function(ctx) {
            var points = this.points,
                pointBetween = this._fontSize,
                spring = this.spring,
                text = this.text,
                dx, dy, dist, scale,
                p0, p1, size, angle,
                i, len;

            points.push(this._endPoint);

            this._updatePoint(points[0]);

            for (i = 0, len = points.length - 1; i < len; i++) {
                p0 = points[i];
                p1 = points[i + 1];

                this._updatePoint(p1);

                dx = p0.x - p1.x;
                dy = p0.y - p1.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                scale = dist ? (p0.between - dist) / dist * 0.5 * spring : 0;
                dx *= scale;
                dy *= scale;

                p0.x += dx;
                p0.y += dy;
                p1.x -= dx;
                p1.y -= dy;
            }

            for (i = 0; i < len; i++) {
                p0 = points[i];
                p1 = points[i + 1];

                dx = p1.x - p0.x;
                dy = p1.y - p0.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                angle = Math.atan2(dy, dx);

                ctx.save();
                size = pointBetween > dist ? pointBetween : dist;
                ctx.font = size + 'px ' + this.fontFamily;
                ctx.translate(p0.x, p0.y);
                ctx.rotate(angle);
                ctx.fillText(p0.letter, 0, 0);
                ctx.restore();
            }

            points.pop();
        },

        _updatePoint: function(p) {
            var friction = 1 - this.friction,
                px = p.px,
                py = p.py;
            p.px = p.x;
            p.py = p.y;

            if (p.fixed) return;

            p.x += (p.x - px) * friction;
            p.y += (p.y - py) * friction;
        }
    };


    /**
     * Point
     */
    function Point(letter, between, x, y) {
        this.letter = letter || '';
        this.between = between || 0;
        this.x = this.px = x || 0;
        this.y = this.py = y || 0;
    }

    Point.prototype = {
        letter: '',
        between: 1,
        x: 0,
        y: 0
    };

    return ElasticString;

})(document);


(function(window, document) {

    'use strict';

    // Configs

    var TEXT = 'The quick brown fox jumps over the lazy dog.',
        FONT_SIZE = 25;


    // Vars

    var canvas, context,
        elasticString,
        mouse = { x: 0, y: 0 },
        drag = null,
        gui, guiOptions;

    // Init

    function init() {
        var pos = [], i, len;

        canvas  = document.getElementById('c');
        context = canvas.getContext('2d');
        resize(null);

        elasticString = new ElasticString(FONT_SIZE, 'Georgia, Times, serif');

        for (i = 0, len = TEXT.length; i < len; i++) {
            if (i === 0)
                pos.push([100, 100]);
            else
                pos.push([canvas.width * Math.random(), canvas.height * Math.random()]);
        }

        elasticString.setText(TEXT, pos);

        window.addEventListener('resize', resize, false);
        document.addEventListener('mousemove', mouseMove, false);
        document.addEventListener('mousedown', mouseDown, false);
        document.addEventListener('mouseup', mouseUp, false);

        // GUI

        guiOptions = {
            text: elasticString.getText(),
            fontSize: elasticString.getFontSize()
        };

        gui = new dat.GUI();
        gui.width = 200;
        gui.add(guiOptions, 'text').onFinishChange(function() {
            elasticString.setText(guiOptions.text);
        });
        gui.add(guiOptions, 'fontSize', 1, 50).onChange(function() {
            elasticString.setFontSize(guiOptions.fontSize);
        });
        gui.add(elasticString, 'friction', 0, 1);
        gui.add(elasticString, 'spring', 0, 1);
        gui.close();

        update();
    }


    // Event Listeners

    function resize(e) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        context.fillStyle = '#3a3a2c';
    }

    function mouseMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }

    function mouseDown(e) {
        var points = elasticString.points,
            p,
            hit = null,
            rangeSq = FONT_SIZE * FONT_SIZE,
            hitNear = FONT_SIZE * FONT_SIZE,
            mx = e.clientX,
            my = e.clientY,
            dx, dy, distSq,
            i, len;

        for (i = 0, len = points.length; i < len; i++) {
            p = points[i];
            dx = mx - p.x;
            dy = my - p.y;
            distSq = dx * dx + dy * dy;
            if (distSq < rangeSq && distSq < hitNear) {
                hitNear = distSq;
                hit = points[i];
            }
        }

        drag = hit;
    }

    function mouseUp(e) {
        drag = null;
    }


    // Update

    function update() {
        var points = elasticString.points,
            p,
            w = canvas.width,
            h = canvas.height,
            i, len;

        if (drag) {
            drag.x = mouse.x;
            drag.y = mouse.y;
        }

        for (i = 0, len = points.length; i < len; i++) {
            p = points[i];

            if (0 > p.x) p.x = 0;
            if (w < p.x) p.x = w;
            if (0 > p.y) p.y = 0;
            if (h < p.y) p.y = h;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        elasticString.render(context);

        requestAnimationFrame(update);
    }


    // Run

    window.addEventListener('load', init, false);

})(window, document);
