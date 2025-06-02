console.log('main.js script started');
import './style.css'
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Car } from './Car.js';
import { Terrain } from './Terrain.js';
import { Game } from './game.js';

// Create loading screen
const loadingElement = document.createElement('div');
loadingElement.id = 'loading';
loadingElement.style.position = 'fixed';
loadingElement.style.top = '0';
loadingElement.style.left = '0';
loadingElement.style.width = '100%';
loadingElement.style.height = '100%';
loadingElement.style.backgroundColor = '#000';
loadingElement.style.color = '#fff';
loadingElement.style.display = 'flex';
loadingElement.style.justifyContent = 'center';
loadingElement.style.alignItems = 'center';
loadingElement.style.fontSize = '24px';
loadingElement.style.fontFamily = 'Arial, sans-serif';
loadingElement.textContent = 'Loading...';
document.body.appendChild(loadingElement);

// Add styles
const style = document.createElement('style');
style.textContent = `
    body {
        margin: 0;
        overflow: hidden;
        background: #000;
    }
    canvas {
        display: block;
    }
    #loading {
        transition: opacity 0.5s;
    }
`;
document.head.appendChild(style);

// Initialize game (only once)
const game = new Game();

// Add keyboard controls help
const helpElement = document.createElement('div');
helpElement.style.position = 'fixed';
helpElement.style.bottom = '20px';
helpElement.style.left = '20px';
helpElement.style.color = '#fff';
helpElement.style.fontFamily = 'Arial, sans-serif';
helpElement.style.fontSize = '14px';
helpElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
helpElement.style.padding = '10px';
helpElement.style.borderRadius = '5px';
helpElement.innerHTML = `
    <h3 style="margin: 0 0 10px 0">Controls:</h3>
    <p style="margin: 5px 0">W/S - Accelerate/Brake</p>
    <p style="margin: 5px 0">A/D - Steer Left/Right</p>
    <p style="margin: 5px 0">Space - Handbrake</p>
    <p style="margin: 5px 0">C - Change Camera</p>
    <p style="margin: 5px 0">R - Reset Car</p>
`;
document.body.appendChild(helpElement);

// Add weather controls
const weatherElement = document.createElement('div');
weatherElement.style.position = 'fixed';
weatherElement.style.top = '20px';
weatherElement.style.right = '20px';
weatherElement.style.color = '#fff';
weatherElement.style.fontFamily = 'Arial, sans-serif';
weatherElement.style.fontSize = '14px';
weatherElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
weatherElement.style.padding = '10px';
weatherElement.style.borderRadius = '5px';
weatherElement.innerHTML = `
    <h3 style="margin: 0 0 10px 0">Weather:</h3>
    <button onclick="game.setWeather('clear')" style="margin: 5px">Clear</button>
    <button onclick="game.setWeather('cloudy')" style="margin: 5px">Cloudy</button>
    <button onclick="game.setWeather('rainy')" style="margin: 5px">Rainy</button>
    <button onclick="game.setWeather('snowy')" style="margin: 5px">Snowy</button>
`;
document.body.appendChild(weatherElement);

// Make game instance globally accessible for weather controls
window.game = game;
