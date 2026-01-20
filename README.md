# BLK BX SitRep OS

A sophisticated AI-powered situational awareness dashboard built with React, featuring real-time data visualization, terminal-style interface, and Google Gemini AI integration.

## ✨ Features

- **🖥️ Terminal UI**: Classic command-line interface with cyberpunk aesthetics
- **🤖 AI Integration**: Powered by Google Gemini AI for intelligent analysis
- **📊 Real-time Charts**: Interactive data visualization with Recharts
- **🗺️ Map Integration**: Leaflet-powered geographical situational awareness
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Modern Stack**: Built with React 19, Vite, and TypeScript

## 🚀 Live Demo

Access the live application: [https://soundsafe-dev.github.io/BLKBX_SITREP/](https://soundsafe-dev.github.io/BLKBX_SITREP/)

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Custom Terminal Theme
- **AI**: Google Gemini AI
- **Charts**: Recharts
- **Maps**: Leaflet
- **Icons**: Lucide React
- **Deployment**: GitHub Pages

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

## 🏃‍♂️ Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SoundSafe-Dev/BLKBX_SITREP.git
   cd BLKBX_SITREP
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:5173`

## 🏗️ Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## 🌐 Deployment

This project is automatically deployed to GitHub Pages. To deploy your own version:

1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Select "Deploy from a branch" → "main" → "/ (root folder)"
4. Your app will be available at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## 📁 Project Structure

```
BLKBX_SITREP/
├── public/
│   └── blk-bx-logo.png
├── src/
│   ├── components/
│   │   └── TerminalUI.tsx
│   ├── services/
│   │   └── gemini.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── types.ts
├── dist/           # Built files (auto-generated)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🎨 Customization

### Terminal Theme
The app features a customizable terminal theme. Key variables in `index.html`:

```css
:root {
  --terminal-bg: #000000;
  --terminal-fg: #ff9900; /* Classic Amber */
  --terminal-accent: #00ffff; /* Cyber cyan */
  --terminal-alert: #ff0000;
}
```

### AI Integration
Modify AI behavior in `services/gemini.ts` to customize prompts and responses.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Terminal design inspired by classic command-line interfaces
- Icons provided by [Lucide React](https://lucide.dev/)
