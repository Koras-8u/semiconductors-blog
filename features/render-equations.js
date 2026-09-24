const scriptUrl = document.currentScript.src;
const equationsUrl = new URL('equations.json', scriptUrl).href;

async function renderEquations() {
    const response = await fetch(equationsUrl);
    const equations = await response.json();

    document.querySelectorAll('[data-eq-id]').forEach(el => {
        const id = el.dataset.eqId;
        if (equations[id]) {
            el.textContent = equations[id].latex;
        } else {
            console.warn(`No equation found for id "${id}"`);
        }
    });

    // Tell MathJax to typeset only after the LaTeX text is in the DOM
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

document.addEventListener('DOMContentLoaded', renderEquations);