/*
 * Jugadas base (borrador) para la biblioteca.
 *
 * Sistema de coordenadas (en metros):
 *   x = largo de la pileta, de 0 a 25. El arco que se ataca está en x = 25.
 *   y = ancho de la pileta, de 0 a 20. y crece hacia la DERECHA del atacante
 *       (mirando al arco que ataca).
 *   Los postes del arco están en y = 8.5 y y = 11.5 (arco de 3 m).
 *
 * Piezas:
 *   A1..A6 = atacantes (gorro oscuro). Por convención A1..A6 ocupan las
 *            posiciones 1..6 del ataque 3-3:
 *            1 = alero derecho, 2 = lateral derecho, 3 = central exterior,
 *            4 = lateral izquierdo, 5 = alero izquierdo, 6 = boya (centro).
 *   D1..D6 = defensores (gorro blanco), cada uno marca a su A del mismo número.
 *   DG     = arquero defensor (gorro rojo).
 *   ball   = pelota.
 */
(function () {
  'use strict';

  const GOAL = [25, 10];
  const r = (v) => Math.round(v * 100) / 100;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Punto a distancia d desde p, en dirección a target (por defecto el arco).
  function toward(p, d, target) {
    const t = target || GOAL;
    const dx = t[0] - p[0];
    const dy = t[1] - p[1];
    const L = Math.hypot(dx, dy) || 1;
    return [r(p[0] + (dx / L) * d), r(p[1] + (dy / L) * d)];
  }

  // Pelota en la mano de un jugador.
  const hold = (p) => [r(p[0] - 0.15), r(p[1] - 0.8)];

  // El arquero acompaña el lado de la pelota.
  function gk(ball) {
    const off = Math.max(-1.1, Math.min(1.1, (ball[1] - 10) * 0.15));
    return [24.4, r(10 + off)];
  }

  // Ataque 3-3 (arco / "paraguas")
  const S33 = {
    A1: [23, 15.5], A2: [20, 14.5], A3: [18, 10],
    A4: [20, 5.5], A5: [23, 4.5], A6: [22.8, 10],
  };

  // Defensa en presión: cada defensor entre su atacante y el arco.
  function press(att, d) {
    const out = {};
    for (let i = 1; i <= 5; i++) out['D' + i] = toward(att['A' + i], d || 0.9);
    out.D6 = [r(att.A6[0] + 0.8), att.A6[1]]; // detrás del boya
    return out;
  }

  function baseStep(attack, defense, ball, hidden) {
    const pos = Object.assign({}, clone(attack), clone(defense));
    pos.ball = ball.slice();
    if (!pos.DG) pos.DG = gk(ball);
    return { pos, hidden: hidden ? hidden.slice() : [], note: '' };
  }

  // Construye los pasos aplicando cambios acumulativos sobre el paso base.
  function build(base, deltas) {
    const steps = [];
    let cur = clone(base);
    for (const d of deltas) {
      if (d.set) for (const k in d.set) cur.pos[k] = d.set[k].slice();
      if (d.ball) cur.pos.ball = d.ball.slice();
      if (d.hide) cur.hidden = Array.from(new Set(cur.hidden.concat(d.hide)));
      if (d.show) cur.hidden = cur.hidden.filter((h) => !d.show.includes(h));
      if (!(d.set && d.set.DG)) cur.pos.DG = gk(cur.pos.ball);
      cur.note = d.note || '';
      steps.push(clone(cur));
    }
    return steps;
  }

  function defaultStep() {
    const s = baseStep(S33, press(S33), hold(S33.A3));
    s.note = '';
    return s;
  }

  const plays = [];
  const add = (p) => plays.push(Object.assign({ view: 'half' }, p));

  /* ---------------- ATAQUE POSICIONAL ---------------- */

  add({
    id: 'base-33-boya',
    name: '3-3: circulación y pase al boya',
    category: 'Ataque posicional',
    description: 'Ataque 3-3 clásico. Se mueve la pelota por afuera para que el boya gane la posición y reciba.',
    steps: build(baseStep(S33, press(S33), hold(S33.A3)), [
      { note: 'Ubicación 3-3 (arco): aleros (1 y 5) y boya (6) a 2 m; laterales (2 y 4) y central (3) afuera. Pelota en el 3.' },
      { ball: hold(S33.A2), note: 'Pase al 2. El boya lucha por la posición frente a su marcador.' },
      { set: { A6: [22.8, 10.9], D6: [23.6, 10.5] }, note: 'El boya "se sienta" del lado de la pelota y pide el pase con la mano libre.' },
      { ball: [22.3, 11.5], note: 'Pase mojado (al agua, delante del boya), lejos del defensor.' },
      { set: { A6: [23.1, 10.8] }, ball: [25.2, 10.9], note: 'Lanzamiento del boya (revés o barrida). Si lo agarran de atrás: exclusión → 6x5.' },
    ]),
  });

  add({
    id: 'base-drive-4',
    name: 'Desmarque del 4 (drive)',
    category: 'Ataque posicional',
    description: 'El lateral izquierdo arranca hacia el arco ganándole la línea a su defensor y recibe adelante.',
    steps: build(baseStep(S33, press(S33), hold(S33.A3)), [
      { note: 'Pelota en el 3. El 4 prepara el desmarque mirando a su defensor.' },
      { set: { A4: [21.8, 7.4], D4: [22.4, 6.9] }, note: 'El 4 arranca hacia el arco (drive) y gana la línea de agua a su defensor.' },
      { set: { A4: [23.1, 8.3], D4: [23.0, 7.3] }, ball: [22.7, 8.7], note: 'Pase adelante, al agua, para que el 4 reciba en carrera.' },
      { ball: [25.2, 9.1], note: 'Tiro de cerca (2-3 m). Si el defensor lo frena de atrás: exclusión o penal.' },
    ]),
  });

  add({
    id: 'base-drive-kickout',
    name: 'Desmarque del 3 y pase atrás',
    category: 'Ataque posicional',
    description: 'El central penetra por el medio; si un defensor se hunde a ayudar, se descarga al jugador que quedó libre.',
    steps: build(baseStep(S33, press(S33), hold(S33.A4)), [
      { note: 'Pelota en el 4.' },
      { set: { A3: [21, 11.6], D3: [21.6, 11.2], D2: [21.5, 12.7] }, note: 'El 3 penetra por el centro. El defensor del 2 se hunde para ayudar.' },
      { ball: hold(S33.A2), note: 'Pase atrás (kickout) al 2, que quedó libre.' },
      { set: { A2: [20.3, 14.1] }, ball: [25.2, 9.0], note: 'Tiro de afuera sin marca. Clave: leer qué defensor ayuda.' },
    ]),
  });

  add({
    id: 'base-bloqueo-5-4',
    name: 'Bloqueo del 5 para el 4',
    category: 'Ataque posicional',
    description: 'El alero izquierdo bloquea al defensor del 4, que sale libre hacia el arco. El 5 rueda como segunda opción.',
    steps: build(baseStep(S33, press(S33), hold(S33.A3)), [
      { note: 'Pelota en el 3.' },
      { set: { A5: [21.4, 5.4], D5: [22.0, 5.0] }, note: 'El 5 sube y pone el cuerpo junto al defensor del 4 (bloqueo).' },
      { set: { A4: [22.3, 8.0], D4: [20.9, 6.4] }, note: 'El 4 sale del bloqueo hacia el arco; su defensor queda trabado.' },
      { set: { A5: [22.6, 6.6], D5: [23.2, 6.1] }, ball: [22.0, 8.5], note: 'Pase al 4. El 5 "rueda" hacia el arco como segunda opción (pick and roll).' },
      { ball: [25.2, 9.4], note: 'Tiro del 4 desde cerca.' },
    ]),
  });

  /* ---------------- CONTRAATAQUE ---------------- */

  add({
    id: 'base-contraataque',
    name: 'Contraataque y llegada al 3-3',
    category: 'Contraataque',
    view: 'full',
    description: 'Tras recuperar la pelota, todos salen nadando; pase largo al que gana la línea. Si no hay ventaja, se arma el 3-3.',
    steps: build(baseStep(
      { A1: [3, 15], A2: [5, 13.5], A3: [6.5, 10], A4: [5, 6.5], A5: [3, 5], A6: [2.9, 10] },
      { D1: [3.8, 15.8], D2: [5.8, 14.2], D3: [7.4, 10.2], D4: [5.8, 6], D5: [3.8, 4.4], D6: [2.3, 10.6] },
      hold([6.5, 10])
    ), [
      { note: 'Recuperación (robo o atajada) cerca de nuestro arco. Todos salen nadando hacia adelante.' },
      {
        set: { A1: [9, 16], A2: [9.5, 13], A3: [8.5, 10], A4: [9, 7], A5: [10, 4], A6: [6, 10],
          D1: [7.6, 15.4], D2: [8.2, 12.6], D3: [7.5, 9.6], D4: [7.8, 7.2], D5: [8.4, 4.6], D6: [4.6, 10.4] },
        ball: hold([8.5, 10]),
        note: 'El más rápido (5) gana la línea por el costado. El resto abre el campo.',
      },
      {
        set: { A1: [15, 15.5], A2: [14, 12.5], A3: [11.5, 10], A4: [13.5, 7.5], A5: [17.5, 5], A6: [9, 10],
          D1: [13.6, 15], D2: [12.6, 12.2], D3: [10.4, 9.8], D4: [12, 7.6], D5: [15.8, 5.4], D6: [7.5, 10.4] },
        ball: [17.3, 4.2],
        note: 'Pase largo adelante, al agua, para el que lleva ventaja.',
      },
      {
        set: { A1: [19.5, 15.5], A2: [18, 12.8], A3: [15.5, 10], A4: [17.5, 8], A5: [21.8, 6.5], A6: [13, 10],
          D1: [18.2, 15], D2: [16.8, 12.4], D3: [14.2, 9.8], D4: [16.2, 7.8], D5: [20.4, 6.3], D6: [11.6, 10.2] },
        ball: hold([21.8, 6.5]),
        note: 'Con ventaja: ir al arco y tirar. Si la defensa se recupera…',
      },
      {
        set: Object.assign({}, S33, press(S33)),
        ball: hold(S33.A3),
        note: '…todos ocupan rápido el 3-3 y se juega ataque posicional.',
      },
    ]),
  });

  /* ---------------- SUPERIORIDAD (6x5) ---------------- */

  const P42 = {
    A1: [22.8, 16], A2: [19.4, 12.8], A3: [19.4, 7.2],
    A4: [22.8, 4], A5: [23.2, 7.9], A6: [23.2, 12.1],
  };
  const D42 = {
    D1: [23.9, 12.6], D5: [23.9, 7.4], D2: [21.4, 14.2],
    D4: [21.4, 5.8], D3: [20.8, 10], D6: [24.6, 19.4],
  };

  add({
    id: 'base-42-superioridad',
    name: 'Superioridad 4-2: pase cruzado',
    category: 'Superioridad (6x5)',
    description: 'Con un rival excluido (20 s): cuatro jugadores cerca de los 2 m y dos tiradores afuera. Mover la zona y buscar el pase cruzado.',
    steps: build(baseStep(P42, D42, hold(P42.A2), ['D6']), [
      { note: '4-2: dos aleros y dos postes cerca de los 2 m, dos tiradores afuera. El rival tiene un jugador excluido.' },
      { set: { D3: [20.6, 8.9], D4: [21.0, 6.4], D2: [21.2, 12.8] }, ball: hold(P42.A3), note: 'Pase rápido entre los de afuera: la zona se desplaza.' },
      { set: { D4: [21.8, 4.9], D3: [21.2, 7.9], D2: [21.4, 12.2] }, ball: hold(P42.A4), note: 'Pase al alero: atrae al defensor y abre el lado contrario.' },
      { ball: [22.9, 11.4], note: 'Pase cruzado al poste contrario.' },
      { ball: [25.2, 10.7], note: 'Tiro de primera en la cara del arco: el arquero no llega a cruzar.' },
    ]),
  });

  const P33s = {
    A1: [23, 15], A2: [19.6, 14.2], A3: [18.6, 10],
    A4: [19.6, 5.8], A5: [23, 5], A6: [23.2, 10],
  };
  const D33s = {
    D1: [23.8, 14.4], D2: [21, 12.2], D3: [24.6, 19.4],
    D4: [21, 7.8], D5: [23.8, 5.6], D6: [23.9, 10],
  };

  add({
    id: 'base-33-superioridad',
    name: 'Superioridad 3-3: cambio de lado',
    category: 'Superioridad (6x5)',
    description: 'Tres a 2 m y tres afuera. Con pases largos de lado a lado se busca al tirador que la zona no alcanza a cubrir.',
    steps: build(baseStep(P33s, D33s, hold(P33s.A3), ['D3']), [
      { note: '3-3 en superioridad: tres a 2 m, tres afuera. El rival defiende con 5.' },
      { set: { D2: [20.6, 13.4], D4: [21.2, 9.6] }, ball: hold(P33s.A2), note: 'Pase al 2: la zona se carga a ese lado.' },
      { set: { D4: [20.6, 7.0] }, ball: hold(P33s.A4), note: 'Pase largo al 4: el defensor llega tarde.' },
      { ball: [25.2, 9.0], note: 'Tiro del 4 antes de que cierren.' },
    ]),
  });

  /* ---------------- DEFENSA ---------------- */

  add({
    id: 'base-defensa-presion',
    name: 'Defensa en presión (individual)',
    category: 'Defensa',
    description: 'Cada defensor marca a su atacante. El marcador del boya se adelanta (frontea) del lado de la pelota.',
    steps: build(baseStep(S33, press(S33), hold(S33.A3)), [
      { note: 'Presión: cada defensor entre su atacante y el arco, encima del que tiene la pelota.' },
      { set: { D2: toward(S33.A2, 0.6), D6: [22.2, 10.9] }, ball: hold(S33.A2), note: 'Pelota en el 2: presión fuerte al 2 y el marcador del boya se adelanta del lado de la pelota.' },
      { set: { D2: toward(S33.A2, 0.9), D6: [23.6, 10] }, ball: hold(S33.A3), note: 'Pelota en el centro: el marcador del boya vuelve atrás.' },
      { set: { D4: toward(S33.A4, 0.6), D6: [22.2, 9.1] }, ball: hold(S33.A4), note: 'Pelota en el 4: frontea del otro lado.' },
    ]),
  });

  const MDROP = {
    D1: toward(S33.A1, 0.9), D5: toward(S33.A5, 0.9), D6: [23.6, 10],
    D3: [21.6, 10], D2: [20.4, 12.4], D4: [20.4, 7.6],
  };

  add({
    id: 'base-defensa-mdrop',
    name: 'Defensa en zona "M" (hundimiento)',
    category: 'Defensa',
    description: 'El defensor del 3 se hunde sobre el boya y los de 2 y 4 cubren los huecos de afuera. Busca forzar tiros de lejos.',
    steps: build(baseStep(S33, MDROP, hold(S33.A3)), [
      { note: 'El defensor del 3 se hunde sobre el boya; 2 y 4 se cierran: la defensa forma una "M".' },
      { set: { D2: [20.6, 13.7], D3: [21.7, 10.6], D4: [20.6, 8.6] }, ball: hold(S33.A2), note: 'Pelota en el 2: sale el defensor más cercano con el brazo alto; los demás se corren.' },
      { set: { D2: [20.6, 11.4], D3: [21.7, 9.4], D4: [20.6, 6.3] }, ball: hold(S33.A4), note: 'Pelota en el 4: se repite del otro lado. El boya sigue doblemente marcado.' },
      { ball: [25.2, 8.8], note: 'Se acepta el tiro de afuera: brazo del defensor + arquero.' },
    ]),
  });

  /* ---------------- INFERIORIDAD (5x6) ---------------- */

  add({
    id: 'base-inferioridad-42',
    name: 'Inferioridad 5x6 contra 4-2',
    category: 'Inferioridad (5x6)',
    description: 'Con un jugador excluido: dos defensores en los postes y tres en zona afuera, con los brazos arriba para bloquear tiros.',
    steps: build(baseStep(P42, D42, hold(P42.A2), ['D6']), [
      { note: 'Excluido el 6. Dos defensores cuidan los postes; tres en zona afuera. Brazos arriba.' },
      { set: { D3: [20.6, 8.9], D4: [21.0, 6.4], D2: [21.2, 12.8] }, ball: hold(P42.A3), note: 'Cada pase: la zona se corre hacia la pelota, siempre con un brazo en la línea de tiro.' },
      { set: { D4: [21.8, 4.9], D3: [21.2, 7.9], D2: [21.4, 12.2] }, ball: hold(P42.A4), note: 'Pelota al alero: el poste del lado débil (D1) vigila el pase cruzado.' },
      { set: { D4: [21.0, 6.4], D3: [20.6, 8.9], D2: [21.2, 12.8] }, ball: hold(P42.A3), note: 'Volver a cerrar. Aguantar 20 s y recuperar al excluido.' },
    ]),
  });

  window.WP = {
    plays,
    defaultStep,
    categories: [
      'Ataque posicional',
      'Superioridad (6x5)',
      'Contraataque',
      'Defensa',
      'Inferioridad (5x6)',
      'Mis jugadas',
    ],
  };
})();
