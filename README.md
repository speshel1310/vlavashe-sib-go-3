# Скутер и Шаурма - Browser Game

Simple browser-based game where a player controls a scooter to collect shawarma and avoid obstacles.

## Recent Updates

1. **3 Lives System**: Player now has 3 lives. Collision with an obstacle removes one life.
2. **UI Improvements**: 
   - Leaderboard button moved to control panel at the bottom
   - Added lives display
3. **Server-side Results Storage**: Game now saves player results to a server-side file

## Game Setup

### Running the Game

1. Host the game on a PHP-compatible web server
2. Ensure the server has write permissions for the `server` directory
3. Access the game through a browser

### Required Files

- `index.html` - Main game HTML
- `style.css` - Game styles
- `game.js` - Game logic
- `server/game-results.php` - Backend for saving results

## Game Controls

- **Left/Right Arrows**: Move the scooter left or right
- **M Key**: Toggle sound on/off

## Game Features

- Collect shawarma (🍣) to gain points
- Avoid obstacles (🐕, 🚐, 🚌)
- Game ends when time runs out or when you lose all lives
- Player scores are saved to a leaderboard
- Responsive design for mobile and desktop play

## Technical Implementation

The game uses:
- HTML5, CSS3, and vanilla JavaScript for front-end
- PHP for server-side storage of results
- LocalStorage as a fallback if server is unavailable

## Credits

Created as a demo browser game. 