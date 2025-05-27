import * as THREE from 'three';

async function loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    
    // Load building texture
    const buildingTexture = await loadTexture(textureLoader, 
        '/textures/brick_wall_1K_Base_Color.jpg'
    );
    buildingTexture.wrapS = buildingTexture.wrapT = THREE.RepeatWrapping;
    buildingTexture.repeat.set(2, 2);

    // Load road texture
    const roadTexture = await loadTexture(textureLoader,
        '/textures/asphalt_1K_Base_Color.jpg'
    );
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(4, 4);

    // Load sidewalk texture
    const sidewalkTexture = await loadTexture(textureLoader,
        '/textures/concrete_1K_Base_Color.jpg'
    );
    sidewalkTexture.wrapS = sidewalkTexture.wrapT = THREE.RepeatWrapping;
    sidewalkTexture.repeat.set(2, 2);

    return {
        building: buildingTexture,
        road: roadTexture,
        sidewalk: sidewalkTexture
    };
}

function loadTexture(loader, url) {
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            texture => resolve(texture),
            undefined,
            error => {
                console.error(`Error loading texture ${url}:`, error);
                // Create a fallback texture with a solid color
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#808080';
                ctx.fillRect(0, 0, 256, 256);
                const fallbackTexture = new THREE.CanvasTexture(canvas);
                resolve(fallbackTexture);
            }
        );
    });
}

export { loadTextures }; 