/*The solution to draggable elements was inspired by w3schools solution on creating a [Draggable HTML Element](https://www.w3schools.com/howto/howto_js_draggable.asp).*/

dragElement(document.getElementById('plant1'));
dragElement(document.getElementById('plant2'));
dragElement(document.getElementById('plant3'));
dragElement(document.getElementById('plant4'));
dragElement(document.getElementById('plant5'));
dragElement(document.getElementById('plant6'));
dragElement(document.getElementById('plant7'));
dragElement(document.getElementById('plant8'));
dragElement(document.getElementById('plant9'));
dragElement(document.getElementById('plant10'));
dragElement(document.getElementById('plant11'));
dragElement(document.getElementById('plant12'));
dragElement(document.getElementById('plant13'));
dragElement(document.getElementById('plant14'));

/*"A closure is the combination of a function bundled together (enclosed) 
with references to its surrounding state (the lexical environment). 
In other words, a closure gives you access to an outer function’s scope 
from an inner function." Create a closure so that you can track the dragged element*/

function dragElement(terrariumElement) {
	if (!terrariumElement) return;

	//set 4 positions for positioning on the screen
	let pos1 = 0,
		pos2 = 0,
		pos3 = 0,
		pos4 = 0;
	let isGrabbed = false;

	terrariumElement.onpointerdown = pointerDrag;

	// Keyboard activation and movement support
	terrariumElement.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			isGrabbed = !isGrabbed;
			terrariumElement.setAttribute('aria-pressed', isGrabbed ? 'true' : 'false');
		} else if (e.key === 'Escape') {
			if (isGrabbed) {
				e.preventDefault();
				isGrabbed = false;
				terrariumElement.setAttribute('aria-pressed', 'false');
			}
		} else if (isGrabbed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			const step = 10;
			const currentTop = terrariumElement.offsetTop;
			const currentLeft = terrariumElement.offsetLeft;

			if (e.key === 'ArrowUp') terrariumElement.style.top = (currentTop - step) + 'px';
			if (e.key === 'ArrowDown') terrariumElement.style.top = (currentTop + step) + 'px';
			if (e.key === 'ArrowLeft') terrariumElement.style.left = (currentLeft - step) + 'px';
			if (e.key === 'ArrowRight') terrariumElement.style.left = (currentLeft + step) + 'px';
		}
	});

	terrariumElement.addEventListener('blur', () => {
		if (isGrabbed) {
			isGrabbed = false;
			terrariumElement.setAttribute('aria-pressed', 'false');
		}
	});

	function pointerDrag(e) {
		e.preventDefault();
		// get the initial mouse cursor position for pos3 and pos4
		pos3 = e.clientX;
		pos4 = e.clientY;
		// when the mouse moves, start the drag
		document.onpointermove = elementDrag;
		// when the mouse is lifted, stop the drag
		document.onpointerup = stopElementDrag;
	}

	function elementDrag(e) {
		// calculate the new cursor position
		// pos1 = where the Xmouse WAS - where it IS
		pos1 = pos3 - e.clientX;
		// pos2 = where the Ymouse WAS - where it IS
		pos2 = pos4 - e.clientY;
		//reset pos3 to current location of Xmouse
		pos3 = e.clientX;
		//reset pos4 to current location of Ymouse
		pos4 = e.clientY;
		// set the element's new position:
		terrariumElement.style.top = terrariumElement.offsetTop - pos2 + 'px';
		terrariumElement.style.left = terrariumElement.offsetLeft - pos1 + 'px';
	}

	function stopElementDrag() {
		// stop calculating when mouse is released
		document.onpointerup = null;
		document.onpointermove = null;
	}
}
