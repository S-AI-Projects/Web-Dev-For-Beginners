// Extension popup initialization and error fallback handling

const headerImg = document.getElementById('header-image') || document.querySelector('img');
const imageFallback = document.getElementById('image-fallback');

function handleImageError() {
	if (headerImg) {
		headerImg.style.display = 'none';
	}
	if (imageFallback) {
		imageFallback.style.display = 'block';
	}
}

if (headerImg) {
	headerImg.addEventListener('error', handleImageError);

	// Check if already completed and failed to load
	if (headerImg.complete && headerImg.naturalWidth === 0) {
		handleImageError();
	}
}

// Global recovery helper function
window.restoreImage = function(src) {
	if (headerImg) {
		if (src) {
			headerImg.src = src;
		}
		headerImg.style.display = 'inline-block';
	}
	if (imageFallback) {
		imageFallback.style.display = 'none';
	}
};
