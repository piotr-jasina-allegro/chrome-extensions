

export function setupApreelTs() {
    createApreelButtons();
    colorizeInputs();
}
function colorizeInputs() {
    document.querySelectorAll('td').forEach(td => {
        if (td.classList.contains('sunday') || td.classList.contains('saturday') || td.classList.contains('vacation')) return;
        td.querySelectorAll('input[type="text"][title="Godziny pracy"]').forEach(input => {
            const updateBg = (event) => {
                if (event.target.value === "0") {
                    event.target.style.backgroundColor = "rgb(223 68 226)";
                } else {
                    event.target.style.backgroundColor = "#ffffff";
                }
            };
            input.addEventListener('input', updateBg);
            updateBg({target: input}); // for initial state
        });
    });
}


function createApreelButtons() {
    const button = document.createElement("button");
    button.textContent = "All to 8!";
    button.style.position = "fixed";
    button.style.bottom = "20px";
    button.style.right = "20px";
    button.style.zIndex = "9999";
    button.style.padding = "10px 16px";
    button.style.backgroundColor = "#4CAF50";
    button.style.color = "#fff";
    button.style.border = "none";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => {
        setAllHoursTo("8");
        console.log("APREELTS Set all hours");
    });
    document.body.appendChild(button);

    const button2 = document.createElement("button");
    button2.textContent = "All to 0!";
    button2.style.position = "fixed";
    button2.style.bottom = "70px";
    button2.style.right = "20px";
    button2.style.zIndex = "9999";
    button2.style.padding = "10px 16px";
    button2.style.backgroundColor = "#4CAF50";
    button2.style.color = "#fff";
    button2.style.border = "none";
    button2.style.borderRadius = "4px";
    button2.style.cursor = "pointer";
    button2.addEventListener("click", () => {
        setAllHoursTo("0");
        console.log("APREELTS Set all hours to 0");
    });
    document.body.appendChild(button2);

    const buttonHolders = document.querySelectorAll('.buttonHolder');
    console.log("APREELTS buttonHolders:", buttonHolders);
    const lastButtonHolder = buttonHolders[buttonHolders.length - 1];
    const button3 = document.createElement("button");
    button3.textContent = "Fill allegro1";
    button3.type = "button";
    button3.style.padding = "3px 16px";
    button3.style.backgroundColor = "#4CAF50";
    button3.style.color = "#fff";
    button3.style.border = "none";
    button3.style.borderRadius = "4px";
    button3.style.cursor = "pointer";
    button3.style.display = "inline-block";
    if (lastButtonHolder) {
        lastButtonHolder.appendChild(button3);
    }
    button3.addEventListener("click", () => {
        setClientAndHours();
        console.log("APREELTS Set Allegro hours to 8");
    });
}

function setClientAndHours() {
    const clientSelect = document.querySelector('select.clientsDropDown');
    if (clientSelect) {
        clientSelect.value = '40064';
        clientSelect.dispatchEvent(new Event('change', {bubbles: true}));
    }
    setAllHoursTo("8");
}

function setAllHoursTo(num) {
    document.querySelectorAll('td').forEach(td => {
        if (td.classList.contains('sunday') || td.classList.contains('saturday') || td.classList.contains('vacation')) return;

        td.querySelectorAll('input[type="text"][title="Godziny pracy"]').forEach(input => {
            input.value = num;
            if (input.value === "0") {
                input.style.backgroundColor = "rgb(223 68 226)";
            } else {
                input.style.backgroundColor = "#ffffff";
            }
        });
    });
    console.log("APREELTS Set all hours to ", num);
}
