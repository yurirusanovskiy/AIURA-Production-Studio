# AIURA Studio — Client (Audiobook Studio Creator)

AIURA Studio is a premium, AI-powered audiobook casting, editing, and voice-generation workshop. It provides a rich, modern, and highly interactive user interface to orchestrate multi-character narration using the Gemini TTS API.

## 📺 Screenshots Showcase

<p align="center">
  <img src="screenshots/1.png" width="48%" alt="AIURA Studio Projects Dashboard" />
  <img src="screenshots/2.png" width="48%" alt="Voice Casting Director" />
</p>
<p align="center">
  <img src="screenshots/3.png" width="48%" alt="Auditions & Voice Selection" />
  <img src="screenshots/4.png" width="48%" alt="Advanced Chapter Editor" />
</p>
<p align="center">
  <img src="screenshots/5.png" width="48%" alt="Multi-Take Audio Selector" />
  <img src="screenshots/6.png" width="48%" alt="Pronunciation Dictionary" />
</p>
<p align="center">
  <img src="screenshots/7.png" width="48%" alt="Settings & Directory Configurations" />
</p>

## 🎧 Created Audiobooks Showcase
Check out actual audiobooks and sample tracks fully produced using AIURA Studio on our YouTube channel:
👉 **[AIURA Studio Showcase on YouTube](https://www.youtube.com/channel/UCkNHE4zeaFT6eJsyO2k8Mqg)**

## 🚀 Key Features

- **Book Uploading & Splitting**: Upload files (.epub, .fb2, .docx, .txt, .pdf) and let the engine chunk them into clean, balanced chapters.
- **Voice Casting Director**: Match and create characters with unique gender, age, and accent profiles.
- **Voice Auditioning**: Generate instant sample reads in the casting panel to check tone, pitch, and voice style before production.
- **Advanced Scene Editor**: Edit chapters line-by-line, toggle manual phonetic stress markers, and add line-specific emotional prompts (e.g. *whispering*, *excitedly*, *stern*).
- **Audio Stitching & Multi-Take Management**: Group audio recordings, swap takes, and stitch chapters into a single master WAV file seamlessly.
- **Settings Dashboard**: Configure your database root folders, voice samples path, and manage active Gemini API keys directly in the user interface.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React & Material UI (MUI v5)
- **State Management**: TanStack Query (React Query v5)
- **Networking**: Axios with normalized global error-interceptor toast notifications

## 📦 Local Installation

### Prerequisites
- Node.js (v20+)
- `pnpm` package manager

### Steps
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the developer server:
   ```bash
   pnpm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) to access the workshop.

*(Note: Requires the AIURA Studio Backend running on port 8000).*

---

## 🔮 Future Roadmap & Alternative Use Cases

AIURA Studio's core casting engine and dialogue-based line editor are highly extensible and naturally adapt to other media formats:

### 🎬 Movie Dubbing & Video Translation
* **Concept**: Import subtitle files (e.g., `.srt`, `.ass`) instead of books.
* **Timeline Binding**: Bind generated voice replica clips directly to subtitle timestamp ranges.
* **Orchestration**: Assign different voice actors to subtitle blocks matching specific characters to auto-generate multi-voice localized voiceovers.

### 🎮 Video Game Localization & Dialog Voicing
* **Concept**: Connect the casting engine to game dialogue localization spreadsheets.
* **Batch Generation**: Bulk-generate all game character replica takes using voice IDs mapped to localization keys.
* **Quality Check**: Audition and review lines directly inside the take selector UI to tweak tone and stress marks before exporting to the game engine.
