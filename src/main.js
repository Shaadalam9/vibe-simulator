console.log('main.js script started');
import './style.css'
import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';
import { Car } from './Car.js';
import { Terrain } from './Terrain.js';
import { Game } from './game.js';

// Wait for the DOM to be fully loaded before initializing the game
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, initializing game.');

    // Get loading screen element
    const loadingElement = document.getElementById('loading');

    // Initialize game
    const game = new Game();
    console.log('Game initialized.');

    // Immediately hide loading screen after game initialization using display: none !important
    if (loadingElement) {
        loadingElement.style.setProperty('display', 'none', 'important');
        console.log('Loading screen display set to none !important.');
    } else {
         console.warn('Loading element with ID #loading not found in DOM after DOMContentLoaded.');
    }

    // UI elements (moved inside DOMContentLoaded)
    const speedElement = document.getElementById('speed');
    const damageElement = document.getElementById('damage');
    const damageFillElement = document.getElementById('damage-fill');
    const weatherButtons = document.querySelectorAll('.weather-controls button');

    // Update UI
    function updateUI() {
        if (!game.car) return; // Ensure car is initialized before updating UI
        // Update speed
        const speed = Math.round(game.car.speed * 3.6); // Convert m/s to km/h
        if(speedElement) speedElement.textContent = speed;

        // Update damage
        const damage = Math.min(100, Math.round(game.car.damage));
        if(damageElement) damageElement.textContent = damage;
        if(damageFillElement) damageFillElement.style.width = `${damage}%`;

        // Update damage bar color
        const hue = (100 - damage) * 1.2; // Green (120) to Red (0)
        if(damageFillElement) damageFillElement.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;

        // Request next frame
        requestAnimationFrame(updateUI);
    }

    // Start UI updates
    updateUI();
    console.log('UI updates started.');

    // Weather controls
    weatherButtons.forEach(button => {
        button.addEventListener('click', () => {
            const weather = button.dataset.weather;

            // Update active button
            weatherButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
    console.log('Weather controls setup.');

    // Add keyboard controls help (moved inside DOMContentLoaded)
    // Check if help element already exists before creating
    let helpElement = document.querySelector('.controls-info');
    if (!helpElement) {
        helpElement = document.createElement('div');
        helpElement.className = 'controls-info'; // Use class as in CSS
        helpElement.innerHTML = `
            <h3>Controls</h3>
            <p>W/S - Accelerate/Brake</p>
            <p>A/D - Steer</p>
            <p>Space - Handbrake</p>
            <p>C - Change Camera</p>
            <p>R - Reset Car</p>
        `;
        document.body.appendChild(helpElement);
    }
    console.log('Controls info setup.');

    // Add weather controls (moved inside DOMContentLoaded)
    // Check if weather controls element already exists before creating
    let weatherElement = document.querySelector('.weather-controls');
    if (!weatherElement) {
         weatherElement = document.createElement('div');
         weatherElement.className = 'weather-controls'; // Use class as in CSS
         weatherElement.innerHTML = `
             <h3>Weather</h3>
             <button data-weather="clear">Clear</button>
             <button data-weather="rainy">Rain</button>
             <button data-weather="snowy">Snow</button>
             <button data-weather="foggy">Fog</button>
         `;
         document.body.appendChild(weatherElement);

         // Re-query buttons after adding element dynamically
         const newWeatherButtons = document.querySelectorAll('.weather-controls button');
         newWeatherButtons.forEach(button => {
             button.addEventListener('click', () => {
                 const weather = button.dataset.weather;

                 newWeatherButtons.forEach(btn => btn.classList.remove('active'));
                 button.classList.add('active');
             });
         });
    }
    console.log('Weather controls added and initial weather set.');

});

// Removed direct initialization code that was here before
