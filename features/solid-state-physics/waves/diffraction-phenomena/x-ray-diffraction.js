(function () {
    var root = document.getElementById('xrd-demo');
    var geo = root.querySelector('#xrd-geo');
    var gctx = geo.getContext('2d');
    var scope = root.querySelector('#xrd-scope');
    var sctx = scope.getContext('2d');
    var readout = root.querySelector('#xrd-readout');

    var thetaSlider = root.querySelector('#xrd-theta');
    var rlSlider = root.querySelector('#xrd-rl');
    var alphaSlider = root.querySelector('#xrd-alpha');
    var thetaVal = root.querySelector('#xrd-theta-val');
    var rlVal = root.querySelector('#xrd-rl-val');
    var alphaVal = root.querySelector('#xrd-alpha-val');

    var css = getComputedStyle(root);
    var COLOR = {
      amber: css.getPropertyValue('--amber').trim(),
      cyan: css.getPropertyValue('--cyan').trim(),
      sum: css.getPropertyValue('--sum').trim(),
      good: css.getPropertyValue('--good').trim(),
      bad: css.getPropertyValue('--bad').trim(),
      mid: css.getPropertyValue('--mid').trim(),
      muted: css.getPropertyValue('--muted').trim(),
      line: css.getPropertyValue('--line').trim(),
      text: css.getPropertyValue('--text').trim()
    };

    // ---- geometry canvas setup -------------------------------------------------
    var GW = geo.width, GH = geo.height;
    var LAMBDA_PX = 40;           // visual wavelength on the geometry canvas
    var originX = 200, originY = 250; // O in canvas pixels

    function toCanvas(mx, my) { return { x: originX + mx, y: originY - my }; }

    function state() {
      var thetaDeg = parseFloat(thetaSlider.value);
      var alphaDeg = parseFloat(alphaSlider.value);
      var rlUnits = parseFloat(rlSlider.value);
      var theta = thetaDeg * Math.PI / 180;
      var alpha = alphaDeg * Math.PI / 180;
      var ni = { x: Math.cos(theta), y: -Math.sin(theta) };   // travel dir, incoming
      var nf = { x: Math.cos(theta), y: Math.sin(theta) };    // travel dir, outgoing
      var RLmagPx = rlUnits * LAMBDA_PX;
      var RL = { x: RLmagPx * Math.cos(alpha), y: RLmagPx * Math.sin(alpha) };
      // delta/lambda in closed form for this symmetric geometry:
      var deltaOverLambda = -2 * rlUnits * Math.sin(alpha) * Math.sin(theta);
      var dphi = 2 * Math.PI * deltaOverLambda;
      return { thetaDeg: thetaDeg, alphaDeg: alphaDeg, rlUnits: rlUnits, theta: theta,
               alpha: alpha, ni: ni, nf: nf, RL: RL, deltaOverLambda: deltaOverLambda, dphi: dphi };
    }

    function dot(a, b) { return a.x * b.x + a.y * b.y; }
    function cross(a, b) { return a.x * b.y - a.y * b.x; }
    function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }

    // Keeps only the part of segment p1->p2 lying on the side of the
    // infinite line through O with direction RL where sign(cross(RL, X)) === sign
    // (points ON the line, cross=0, count as included on either side).
    function clipSegmentToSign(p1, p2, RL, sign) {
      var s1 = cross(RL, p1) * sign;
      var s2 = cross(RL, p2) * sign;
      if (s1 >= 0 && s2 >= 0) return [p1, p2];
      if (s1 < 0 && s2 < 0) return null;
      var t = s1 / (s1 - s2);
      var mid = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
      return s1 >= 0 ? [p1, mid] : [mid, p2];
    }

    function drawArrow(ctx, from, to, color, width) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width || 2;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      var ang = Math.atan2(to.y - from.y, to.x - from.x);
      var hs = 7;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - hs * Math.cos(ang - Math.PI / 7), to.y - hs * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(to.x - hs * Math.cos(ang + Math.PI / 7), to.y - hs * Math.sin(ang + Math.PI / 7));
      ctx.closePath(); ctx.fill();
    }

    // Draws animated wavefronts (perpendicular to direction n) but only the
    // segment that spans exactly between the ray-through-O and the
    // ray-through-P (both parallel to n) — i.e. the "channel" bounded by
    // the two solid boundary rays — and only the half that lies on the
    // requested side (sign) of the infinite line through O and P.
    function drawWavefronts(ctx, n, RL, sMin, sMax, marginBefore, marginAfter, phase, clipSign, color) {
      var tperp = { x: -n.y, y: n.x };
      var uP = dot(RL, tperp); // perpendicular offset of the P-ray relative to the O-ray
      var s0 = sMin - marginBefore;
      var s1 = sMax + marginAfter;
      var start = Math.floor((s0 - phase) / LAMBDA_PX) * LAMBDA_PX + phase;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      for (var s = start; s <= s1; s += LAMBDA_PX) {
        if (s < s0) continue;
        var p1m = { x: s * n.x, y: s * n.y };
        var p2m = { x: p1m.x + uP * tperp.x, y: p1m.y + uP * tperp.y };
        var clipped = clipSegmentToSign(p1m, p2m, RL, clipSign);
        if (!clipped) continue;
        var c1 = toCanvas(clipped[0].x, clipped[0].y);
        var c2 = toCanvas(clipped[1].x, clipped[1].y);
        ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    function drawArc(ctx, center, r, startAngCanvas, endAngCanvas, color, label, labelAng) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(center.x, center.y, r, startAngCanvas, endAngCanvas, endAngCanvas < startAngCanvas);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = color; ctx.font = '12px sans-serif';
        var lx = center.x + (r + 14) * Math.cos(labelAng);
        var ly = center.y + (r + 14) * Math.sin(labelAng);
        ctx.fillText(label, lx - 4, ly + 4);
      }
    }

    var t0 = performance.now();

    function drawGeo(now) {
      var st = state();
      var elapsed = (now - t0) / 1000;
      var speed = 26; // px/sec of apparent wave travel
      var phase = (elapsed * speed) % LAMBDA_PX;

      gctx.clearRect(0, 0, GW, GH);

      // horizontal reference axis
      gctx.strokeStyle = COLOR.line; gctx.lineWidth = 1;
      gctx.beginPath(); gctx.moveTo(0, originY); gctx.lineTo(GW, originY); gctx.stroke();

      var O = { x: 0, y: 0 };
      var P = st.RL;
      var sIn = [dot(O, st.ni), dot(P, st.ni)];
      var sOut = [dot(O, st.nf), dot(P, st.nf)];

      // Boundary rays: A-P and C-O carry the incident beam, P-R and O-S
      // carry the outgoing beam (matches the textbook figure's labels).
      var RAY = 250;
      var A = { x: P.x - RAY * st.ni.x, y: P.y - RAY * st.ni.y };
      var C = { x: O.x - RAY * st.ni.x, y: O.y - RAY * st.ni.y };
      var R = { x: P.x + RAY * st.nf.x, y: P.y + RAY * st.nf.y };
      var S = { x: O.x + RAY * st.nf.x, y: O.y + RAY * st.nf.y };

      // Which side of the infinite O-P line each beam is confined to.
      var incidentSign = Math.sign(-cross(st.RL, st.ni)) || 1; // side containing A, C
      var outgoingSign = Math.sign(cross(st.RL, st.nf)) || 1;  // side containing R, S

      drawWavefronts(gctx, st.ni, st.RL, Math.min.apply(null, sIn), Math.max.apply(null, sIn), 5 * LAMBDA_PX, 3 * LAMBDA_PX, phase, incidentSign, COLOR.amber);
      drawWavefronts(gctx, st.nf, st.RL, Math.min.apply(null, sOut), Math.max.apply(null, sOut), 3 * LAMBDA_PX, 5 * LAMBDA_PX, phase, outgoingSign, COLOR.cyan);

      // solid boundary rays
      function ray(p1, p2, color, dash) {
        var c1 = toCanvas(p1.x, p1.y), c2 = toCanvas(p2.x, p2.y);
        gctx.strokeStyle = color; gctx.lineWidth = 1.6;
        if (dash) gctx.setLineDash(dash); else gctx.setLineDash([]);
        gctx.beginPath(); gctx.moveTo(c1.x, c1.y); gctx.lineTo(c2.x, c2.y); gctx.stroke();
        gctx.setLineDash([]);
      }
      ray(A, P, COLOR.amber);
      ray(C, O, COLOR.amber);
      ray(P, R, COLOR.cyan);
      ray(O, S, COLOR.cyan);

      // theta arcs at O (between horizontal axis and ni / nf)
      drawArc(gctx, toCanvas(0, 0), 36, 0, st.theta, COLOR.cyan, '\u03B8', -st.theta / 2);
      drawArc(gctx, toCanvas(0, 0), 36, 0, -st.theta, COLOR.amber, '\u03B8', st.theta / 2);

      // n_i / n_f unit-vector arrows, drawn alongside their boundary rays
      var niMid = { x: 0.62 * C.x, y: 0.62 * C.y };
      var niTipM = { x: niMid.x + 46 * st.ni.x, y: niMid.y + 46 * st.ni.y };
      drawArrow(gctx, toCanvas(niMid.x, niMid.y), toCanvas(niTipM.x, niTipM.y), COLOR.amber, 2.4);
      gctx.fillStyle = COLOR.amber; gctx.font = '13px sans-serif';
      var niLbl = toCanvas(niTipM.x, niTipM.y);
      gctx.fillText('n\u1D62 (k\u1D62)', niLbl.x - 10, niLbl.y - 10);

      var nfMid = { x: O.x + 0.35 * (S.x - O.x), y: O.y + 0.35 * (S.y - O.y) };
      var nfTipM = { x: nfMid.x + 46 * st.nf.x, y: nfMid.y + 46 * st.nf.y };
      drawArrow(gctx, toCanvas(nfMid.x, nfMid.y), toCanvas(nfTipM.x, nfTipM.y), COLOR.cyan, 2.4);
      gctx.fillStyle = COLOR.cyan;
      var nfLbl = toCanvas(nfTipM.x, nfTipM.y);
      gctx.fillText('n_f (k_f)', nfLbl.x + 6, nfLbl.y + 4);

      // R_L vector
      var Oc = toCanvas(0, 0), Pc = toCanvas(P.x, P.y);
      drawArrow(gctx, Oc, Pc, COLOR.sum, 2.2);
      gctx.fillStyle = COLOR.sum; gctx.font = '13px sans-serif';
      gctx.fillText('R_L', (Oc.x + Pc.x) / 2 + 6, (Oc.y + Pc.y) / 2 - 8);

      // O and P points
      gctx.fillStyle = COLOR.text;
      gctx.beginPath(); gctx.arc(Oc.x, Oc.y, 4, 0, 2 * Math.PI); gctx.fill();
      gctx.fillText('O', Oc.x - 16, Oc.y + 16);
      gctx.beginPath(); gctx.arc(Pc.x, Pc.y, 4, 0, 2 * Math.PI); gctx.fill();
      gctx.fillText('P', Pc.x + 8, Pc.y - 8);

      // A / C / R / S labels at the ends of the boundary rays (clipped to canvas)
      function clampToCanvas(p) {
        var c = toCanvas(p.x, p.y);
        return { x: Math.max(14, Math.min(GW - 14, c.x)), y: Math.max(14, Math.min(GH - 8, c.y)) };
      }
      gctx.font = '13px sans-serif';
      gctx.fillStyle = COLOR.amber;
      var Al = clampToCanvas(A); gctx.fillText('A', Al.x - 4, Al.y);
      var Cl = clampToCanvas(C); gctx.fillText('C', Cl.x - 4, Cl.y);
      gctx.fillStyle = COLOR.cyan;
      var Rl = clampToCanvas(R); gctx.fillText('R', Rl.x - 4, Rl.y);
      var Sl = clampToCanvas(S); gctx.fillText('S', Sl.x - 4, Sl.y);

      return { st: st, elapsed: elapsed };
    }

    function verdict(deltaOverLambda) {
      var frac = deltaOverLambda - Math.round(deltaOverLambda);
      var distToInt = Math.abs(frac);          // 0 = constructive
      var distToHalf = Math.abs(Math.abs(frac) - 0.5); // 0 = destructive
      if (distToInt < 0.06) return { text: 'Constructive \u2014 diffraction peak', color: COLOR.good };
      if (distToHalf < 0.06) return { text: 'Destructive \u2014 cancellation', color: COLOR.bad };
      return { text: 'Partial interference', color: COLOR.mid };
    }

    function drawScope(elapsed, dphi) {
      var W = scope.width, H = scope.height;
      sctx.clearRect(0, 0, W, H);
      var rows = [
        { y: 42, color: COLOR.amber, phase: 0, label: 'wave scattered at O' },
        { y: 112, color: COLOR.cyan, phase: dphi, label: 'wave scattered at P' }
      ];
      var amp = 24;
      var kSpatial = (2 * Math.PI) / (W / 4.2); // ~4 cycles across width
      var omega = 2.4; // rad/sec, purely for visual motion

      rows.forEach(function (row) {
        sctx.strokeStyle = COLOR.line; sctx.lineWidth = 1;
        sctx.beginPath(); sctx.moveTo(0, row.y); sctx.lineTo(W, row.y); sctx.stroke();
        sctx.strokeStyle = row.color; sctx.lineWidth = 2; sctx.beginPath();
        for (var x = 0; x <= W; x += 2) {
          var y = row.y - amp * Math.sin(kSpatial * x - omega * elapsed + row.phase);
          if (x === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
        }
        sctx.stroke();
        sctx.fillStyle = COLOR.muted; sctx.font = '11px sans-serif';
        sctx.fillText(row.label, 6, row.y - amp - 6);
      });

      // sum trace
      var sumY = 182, sumAmp = 24;
      sctx.strokeStyle = COLOR.line; sctx.lineWidth = 1;
      sctx.beginPath(); sctx.moveTo(0, sumY); sctx.lineTo(W, sumY); sctx.stroke();
      sctx.strokeStyle = COLOR.sum; sctx.lineWidth = 2.4; sctx.beginPath();
      for (var x2 = 0; x2 <= W; x2 += 2) {
        var y1 = Math.sin(kSpatial * x2 - omega * elapsed);
        var y2 = Math.sin(kSpatial * x2 - omega * elapsed + dphi);
        var y = sumY - (sumAmp / 2) * (y1 + y2);
        if (x2 === 0) sctx.moveTo(x2, y); else sctx.lineTo(x2, y);
      }
      sctx.stroke();
      sctx.fillStyle = COLOR.muted; sctx.font = '11px sans-serif';
      sctx.fillText('sum at the detector', 6, sumY - sumAmp - 6);
    }

    function updateReadout(st) {
        var v = verdict(st.deltaOverLambda);
        var resultAmp = 2 * Math.abs(Math.cos(st.dphi / 2));
        readout.innerHTML =
            '<div class="xrd-row"><span>\u03B8</span><span>' + st.thetaDeg.toFixed(0) + '\u00B0</span></div>' +
            '<div class="xrd-row"><span>|R_L| / \u03BB</span><span>' + st.rlUnits.toFixed(2) + '</span></div>' +
            '<div class="xrd-row"><span>\u03B1 (R_L direction)</span><span>' + st.alphaDeg.toFixed(0) + '\u00B0</span></div>' +
            '<div class="xrd-row"><span>\u03B4 / \u03BB</span><span>' + st.deltaOverLambda.toFixed(3) + '</span></div>' +
            '<div class="xrd-row"><span>\u03B4\u03C6</span><span>' + (st.dphi / Math.PI).toFixed(3) + '\u03C0 rad</span></div>' +
            '<div class="xrd-row"><span>resultant amplitude</span><span>' + resultAmp.toFixed(2) + ' / 2</span></div>' +
            '<div class="xrd-verdict" style="background:' + v.color + '22;color:' + v.color + ';border:1px solid ' + v.color + '55;">' + v.text + '</div>';
    }

    function tick(now) {
        var out = drawGeo(now);
        drawScope(out.elapsed, out.st.dphi);
        updateReadout(out.st);
        requestAnimationFrame(tick);
    }

    thetaSlider.addEventListener('input', function () { thetaVal.textContent = thetaSlider.value + '\u00B0'; });
    rlSlider.addEventListener('input', function () { rlVal.textContent = parseFloat(rlSlider.value).toFixed(2) + '\u03BB'; });
    alphaSlider.addEventListener('input', function () { alphaVal.textContent = alphaSlider.value + '\u00B0'; });

    requestAnimationFrame(tick);
    })();