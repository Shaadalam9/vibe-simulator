import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const textures = [
    {
        name: 'brick_wall_1K_Base_Color.jpg',
        url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall/brick_wall_1K_Base_Color.jpg'
    },
    {
        name: 'asphalt_1K_Base_Color.jpg',
        url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt/asphalt_1K_Base_Color.jpg'
    },
    {
        name: 'concrete_1K_Base_Color.jpg',
        url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete/concrete_1K_Base_Color.jpg'
    }
];

const downloadTexture = (url, filename) => {
    return new Promise((resolve, reject) => {
        const texturesDir = path.join(__dirname, 'public', 'textures');
        const filePath = path.join(texturesDir, filename);
        
        // Create textures directory if it doesn't exist
        if (!fs.existsSync(texturesDir)) {
            fs.mkdirSync(texturesDir, { recursive: true });
        }

        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            reject(err);
        });

        file.on('error', (err) => {
            fs.unlink(filePath, () => {});
            reject(err);
        });
    });
};

async function downloadAllTextures() {
    try {
        for (const texture of textures) {
            await downloadTexture(texture.url, texture.name);
        }
        console.log('All textures downloaded successfully!');
    } catch (error) {
        console.error('Error downloading textures:', error);
    }
}

downloadAllTextures(); 
