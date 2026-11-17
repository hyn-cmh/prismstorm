// Keyboard and mouse state for the game. The rest of the game reads the
// plain object this returns once per frame; listeners only record events.
// Mouse position is kept in canvas pixels, and firing is "the primary
// button is held" (or Space), which is what a twin-stick wants.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0,
    mouseY: 0,
    firing: false,
    dashPressed: false,
    pausePressed: false,
    confirmPressed: false,
    choicePressed: 0, // 1, 2 or 3 when a number key picks an upgrade card
    anyPressed: false,
  };

  addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    input.anyPressed = true;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyK') input.dashPressed = true;
    if (event.code === 'KeyP' || event.code === 'Escape') input.pausePressed = true;
    if (event.code === 'Enter' || event.code === 'Space') input.confirmPressed = true;
    if (event.code === 'Digit1') input.choicePressed = 1;
    if (event.code === 'Digit2') input.choicePressed = 2;
    if (event.code === 'Digit3') input.choicePressed = 3;
    if (event.code === 'Space') event.preventDefault();
  });
  addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  addEventListener('blur', () => {
    keys.clear();
    input.firing = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.firing = true;
      input.anyPressed = true;
      input.confirmPressed = true;
    }
  });
  addEventListener('mouseup', (event) => {
    if (event.button === 0) input.firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Movement axes from the held keys, normalised so diagonals are not faster.
  input.moveAxis = function moveAxis() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const scale = Math.SQRT1_2;
      x *= scale;
      y *= scale;
    }
    return { x, y };
  };

  // End-of-frame housekeeping: one-shot presses live for exactly one step.
  input.endFrame = function endFrame() {
    input.dashPressed = false;
    input.pausePressed = false;
    input.confirmPressed = false;
    input.choicePressed = 0;
    input.anyPressed = false;
  };

  return input;
}
