import { createRoot } from "react-dom/client";
import App from "./app-supabase";
import "./index.css";

// Add custom font
const burbank = document.createElement("link");
burbank.rel = "stylesheet";
burbank.href = "https://fonts.cdnfonts.com/css/burbank-big-condensed-black";
document.head.appendChild(burbank);

// Add Inter font
const inter = document.createElement("link");
inter.rel = "stylesheet";
inter.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
document.head.appendChild(inter);

// Add Font Awesome
const fontAwesome = document.createElement("link");
fontAwesome.rel = "stylesheet";
fontAwesome.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
document.head.appendChild(fontAwesome);

// Add title
const title = document.createElement("title");
title.textContent = "Fortnite Fantasy League";
document.head.appendChild(title);

createRoot(document.getElementById("root")!).render(<App />);
