/*
 * Algorithm library. Every card shows:
 *   - Forward: the algorithm and a picture of the case it solves
 *   - Reverse: the inverted algorithm and a picture of the case it solves
 * Pictures are generated from the moves, so they always match the algorithm.
 */
window.ALGORITHM_GROUPS = [
  {
    id: 'notation',
    title: 'Notation – every move',
    intro: 'Hold the Pyraminx with one face toward you and one tip pointing up. Each letter names a vertex: U = top, L = front-left, R = front-right, B = back. A capital letter turns the big layer (tip plus middle layer); a lowercase letter turns only the tip. A letter on its own means clockwise, looking at that vertex from outside. A prime (\') means anticlockwise.',
    items: [
      { name: 'U – Up layer', alg: 'U', desc: 'Turn the top two layers clockwise, looking down on the top tip.' },
      { name: 'L – Left layer', alg: 'L', desc: 'Turn the front-left vertex layer clockwise.' },
      { name: 'R – Right layer', alg: 'R', desc: 'Turn the front-right vertex layer clockwise.' },
      { name: 'B – Back layer', alg: 'B', desc: 'Turn the back vertex layer clockwise.' },
      { name: 'u – Up tip', alg: 'u', desc: 'Turn only the top tip clockwise.' },
      { name: 'l – Left tip', alg: 'l', desc: 'Turn only the front-left tip clockwise.' },
      { name: 'r – Right tip', alg: 'r', desc: 'Turn only the front-right tip clockwise.' },
      { name: 'b – Back tip', alg: 'b', desc: 'Turn only the back tip clockwise.' },
    ],
  },
  {
    id: 'first-layer',
    title: 'Step 2 – First layer (bottom) edges',
    intro: 'After you solve the tips and line up the centres, insert the three bottom edges. Hold the bottom face down and use these short triggers.',
    items: [
      { name: 'Right insert', alg: "R U R'", desc: 'Brings an edge from the top layer down into the bottom layer on the right.' },
      { name: 'Right insert (other way)', alg: "R U' R'", desc: 'The same insert, for when the edge faces the other way.' },
      { name: 'Left insert', alg: "L' U' L", desc: 'Mirror of the right insert, for the left side.' },
      { name: 'Left insert (other way)', alg: "L' U L", desc: 'Mirror insert, for when the edge faces the other way.' },
      { name: 'Sledgehammer', alg: "R' L R L'", desc: 'Swaps the front bottom edge with a top edge. Use it to pull out a bottom edge that is stuck or flipped.' },
      { name: 'Mirror sledgehammer', alg: "L R' L' R", desc: 'Left-hand mirror of the sledgehammer.' },
      { name: 'Right pair', alg: "R U R' U'", desc: 'A sexy-move style trigger that cycles edges between the top and bottom layers.' },
      { name: 'Left pair', alg: "U' L' U L", desc: 'Left-hand version of the pair trigger.' },
    ],
  },
  {
    id: 'last-layer',
    title: 'Step 3 – Last layer (all 11 cases)',
    intro: 'Keep the solved layer on the bottom. Only the three top edges are left. Every possible case is listed below. U at the start and end of some algorithms is just a turn to position the case.',
    items: [
      { name: '3-cycle clockwise', alg: "R U R' U R U R'", alt: "L U L' U L U L'", desc: 'The three top edges cycle clockwise, seen from above, and keep their orientation.' },
      { name: '3-cycle anticlockwise', alg: "R' U' R U' R' U' R", alt: "L' U' L U' L' U' L", desc: 'The three top edges cycle anticlockwise, seen from above, and keep their orientation.' },
      { name: 'Flip front-left & front-right', alg: "R' L R L' U L' U' L", desc: 'Both front top edges are in place but flipped.' },
      { name: 'Flip front-right & back', alg: "U R' L R L' U L' U' L U'", desc: 'The front-right and back edges are flipped.' },
      { name: 'Flip front-left & back', alg: "U' R' L R L' U L' U' L U", desc: 'The front-left and back edges are flipped.' },
      { name: '3-cycle clockwise + flip (A)', alg: "R U R' U' R' L R L'", desc: 'The edges cycle clockwise, and two of them come out flipped.' },
      { name: '3-cycle clockwise + flip (B)', alg: "U R U R' U' R' L R L' U'", desc: 'Same as A, with the flipped pair in a different position.' },
      { name: '3-cycle clockwise + flip (C)', alg: "U' R U R' U' R' L R L' U", desc: 'Same as A, with the flipped pair in the third position.' },
      { name: '3-cycle anticlockwise + flip (A)', alg: "L' U' L U L R' L' R", desc: 'The edges cycle anticlockwise, and two of them come out flipped.' },
      { name: '3-cycle anticlockwise + flip (B)', alg: "U L' U' L U L R' L' R U'", desc: 'Same as A, with the flipped pair in a different position.' },
      { name: '3-cycle anticlockwise + flip (C)', alg: "U' L' U' L U L R' L' R U", desc: 'Same as A, with the flipped pair in the third position.' },
    ],
  },
];
