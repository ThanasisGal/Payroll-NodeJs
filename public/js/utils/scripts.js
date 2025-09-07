document.addEventListener("DOMContentLoaded", function () {
    const autoCloseElements = document.querySelectorAll(".auto-close");

    function fadeAndSlide(element) {
        const fadeDuration = 500;
        const slideDuration = 500;

        let opacity = 1;
        const fadeInterval = setInterval(function () {
            if (opacity > 0) {
                opacity -= 0.1;
                element.style.opacity = opacity;
            } else {
                clearInterval(fadeInterval);
                let height = element.offsetHeight;
                const slideInterval = setInterval(function () {
                if (height > 0) {
                    height -= 10;
                    element.style.height = height + "px";
                } else {
                    clearInterval(slideInterval);
                    // Διόρθωση εδώ
                    if (element.parentNode) {
                    element.parentNode.removeChild(element);
                    }
                }
                }, slideDuration / 10);
            }
        }, fadeDuration / 10);
    }

    setTimeout(function () {
        autoCloseElements.forEach(function (element) {
            fadeAndSlide(element);
        });
    }, 4000);
});
