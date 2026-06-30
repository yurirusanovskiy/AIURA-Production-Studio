# Audiobook TTS - Full API Reference for Next.js Client

This is the complete and exhaustive list of all endpoints in the backend, along with exact JSON structures.

---

## 1. Projects (`/api/v1/projects`)

### `GET /`
Returns all projects.
```json
// Response (200 OK)
[
  {
    "id": "book_01",
    "title": "Sherlock Holmes",
    "language_code": "ru-RU"
  }
]
```

### `GET /{project_id}`
Get a specific project.
```json
// Response (200 OK)
{
  "id": "book_01",
  "title": "Sherlock Holmes",
  "language_code": "ru-RU"
}
```

### `POST /`
Create a new project.
```json
// Request Body
{
  "id": "book_01",
  "title": "Sherlock Holmes",
  "language_code": "ru-RU"
}
// Response (200 OK): Returns created project object
```

### `PUT /{project_id}`
Update an existing project's metadata. Fields are optional.
```json
// Request Body
{
  "title": "Sherlock Holmes (Updated)",
  "language_code": "en-US"
}
// Response (200 OK): Returns updated project object
```

### `DELETE /{project_id}`
Cascading delete of a project (removes all scenes, lines, and project links).
```json
// Response (200 OK)
{
  "ok": true,
  "message": "Project and all associated scenes deleted"
}
```

### `POST /{project_id}/upload-book`
Uploads a `.txt` file, chunks it semantically, and automatically creates Scenes for the project.
```json
// Request: multipart/form-data with a file field named "file"
// Response (200 OK)
{
  "ok": true,
  "message": "Successfully chunked book into 12 scenes.",
  "scenes_created": 12
}
```

---

## 2. Characters (`/api/v1/characters`)

### `GET /`
Returns all characters globally available, including their language profiles.
```json
// Response (200 OK)
[
  {
    "id": "char_james",
    "name": "James",
    "voice_id": "Puck",
    "prompt_style": "Speak confidently",
    "gender": "male",
    "age_category": "adult",
    "language_profiles": [
      {
        "id": 1,
        "character_id": "char_james",
        "language_code": "ru-RU",
        "is_native": false,
        "accent_description": "Speaks with an English accent"
      }
    ]
  }
]
```

### `GET /{character_id}`
Get a specific character with language profiles. Response matches the single object from above.

### `POST /`
Create a new character.
```json
// Request Body
{
  "id": "char_james",
  "name": "James",
  "voice_id": "Puck",
  "prompt_style": "Speak confidently",
  "gender": "male",
  "age_category": "adult"
}
// Response (200 OK): Returns created character (without language profiles initially)
```

### `PUT /{character_id}`
Update a character. Fields are optional.
```json
// Request Body
{
  "name": "James Bond",
  "prompt_style": "Speak very mysteriously",
  "voice_id": "Aoede",
  "gender": "male",
  "age_category": "adult"
}
// Response (200 OK): Returns updated character
```

### `DELETE /{character_id}`
Delete a character entirely.
```json
// Response (200 OK)
{ "ok": true }
```

### `POST /{character_id}/language-profiles/`
Add a language profile to a character (to define accents).
```json
// Request Body
{
  "language_code": "ru-RU",
  "is_native": false,
  "accent_description": "Heavy french accent"
}
// Response (200 OK): Returns created profile with ID
```

### `DELETE /{character_id}/language-profiles/{profile_id}`
Delete a specific language profile.
```json
// Response (200 OK)
{ "ok": true }
```

---

## 3. Project-Character Linking

To use a character in a project, they must be linked.

### `GET /api/v1/projects/{project_id}/characters`
Get all characters currently linked to a specific project.
```json
// Response (200 OK): Array of Character objects (same schema as GET /characters/)
```

### `POST /api/v1/projects/{project_id}/characters/discover`
**AI Casting Director**: Discovers characters from raw text, their traits, and suggests mapping them to existing voices in the project/database, or creating new ones.
```json
// Request Body
{
  "raw_text": "An old man slowly walked down the street. \"My bones ache,\" he grumbled."
}
// Response (200 OK)
[
  {
    "discovered_name": "Old Man",
    "traits": "grumpy, tired",
    "gender": "male",
    "age_category": "elderly",
    "action": "use_existing", // or "create_new"
    "existing_character_id": "old_john", // present if action == "use_existing"
    "suggested_voice_id": null // present if action == "create_new"
  }
]
```

### `POST /api/v1/projects/{project_id}/characters/{character_id}`
Link a character to a project.
```json
// Request: None
// Response (200 OK)
{
  "ok": true,
  "message": "Character linked to project"
}
```

### `DELETE /api/v1/projects/{project_id}/characters/{character_id}`
Unlink character from project.
```json
// Request: None
// Response (200 OK)
{
  "ok": true,
  "message": "Character unlinked from project"
}
```

---

## 4. Scenes (`/api/v1/scenes` and `/api/v1/projects/{id}/scenes`)
Scenes store the actual dialogue text.

### `GET /api/v1/projects/{project_id}/scenes`
List all scenes for a project. (Lines are not fully loaded here, just metadata).
```json
// Response (200 OK)
[
  {
    "id": "scene_uuid",
    "project_id": "book_01",
    "title": "Chapter 1",
    "order_index": 0,
    "audio_url": null
  }
]
```

### `POST /api/v1/projects/{project_id}/scenes`
Create a manual scene with lines.
```json
// Request Body
{
  "title": "Chapter 1",
  "lines": [
    {
      "character_id": "char_james",
      "text": "Hello world",
      "prompt_override": null,
      "language_override": null
    }
  ]
}
// Response (200 OK): Returns the fully created Scene object (see GET /scenes/{scene_id})
```

### `POST /api/v1/projects/{project_id}/scenes/generate-from-text`
**AI Script Extractor**: Send raw text, let Gemini build the scene.
```json
// Request Body
{
  "title": "Chapter 1",
  "raw_text": "Alice walked in. \"Hello there,\" she said warmly."
}
// Response (200 OK): Returns the fully created Scene object (see GET /scenes/{scene_id})
```

### `GET /api/v1/scenes/{scene_id}`
Get a scene along with all its dialogue lines. Used to populate the script editor UI.
```json
// Response (200 OK)
{
  "id": "scene_uuid",
  "project_id": "book_01",
  "title": "Chapter 1",
  "order_index": 0,
  "audio_url": null,
  "lines": [
    {
      "id": 1,
      "scene_id": "scene_uuid",
      "character_id": null, // null means narrator
      "text": "Alice walked in.",
      "prompt_override": null,
      "language_override": null,
      "order_index": 0
    },
    {
      "id": 2,
      "scene_id": "scene_uuid",
      "character_id": "char_alice",
      "text": "Hello there,",
      "prompt_override": "Speak warmly",
      "language_override": null,
      "order_index": 1
    }
  ]
}
```

### `PUT /api/v1/scenes/{scene_id}`
Update the entire scene. Useful when the user edits text, changes character assignments, or reorders lines in the UI.
```json
// Request Body
{
  "title": "Chapter 1 (Edited)",
  "lines": [
    {
      "character_id": "char_alice",
      "text": "Hello there, edited text!",
      "prompt_override": "Whisper",
      "language_override": null
    }
  ]
}
// Response (200 OK): Returns updated Scene object
```

### `DELETE /api/v1/scenes/{scene_id}`
Delete a scene and all its lines.
```json
// Response (200 OK)
{ "ok": true }
```

---

## 5. Processing / Audio Generation (`/api/v1/processing`)

### `POST /preprocess-only`
Test how the text will be parsed by phonetics/dictionaries without calling the Gemini Audio API.
```json
// Request Body
{
  "project_id": "book_01",
  "lines": [
    {
      "character_id": "char_james",
      "text": "Я иду в замок."
    }
  ]
}
// Response (200 OK)
{
  "scene_id": "preview",
  "processed_lines": [
    {
      "character_id": "char_james",
      "original_text": "Я иду в замок.",
      "processed_text": "Я иду в з+амок."
    }
  ]
}
```

### `POST /process-scene`
Trigger the Gemini TTS engine to generate the final audio file for an existing scene.
```json
// Request Body
{
  "scene_id": "scene_uuid"
}

// Response (200 OK)
{
  "scene_id": "scene_uuid",
  "audio_file_url": "/static/audio/book_01/scene_uuid.wav"
}
```
*Play audio in UI using `<audio src="http://localhost:8000/static/audio/book_01/scene_uuid.wav"></audio>`*

---

## 6. Dictionary (`/api/v1/dictionary`)
Manage custom phonetic rules.

### `GET /`
Get all words. Can be filtered by `?language=ru`.
```json
// Response (200 OK)
[
  {
    "id": 1,
    "language": "ru",
    "word": "замок",
    "phonetic_replacement": "з+амок"
  }
]
```

### `POST /`
Create a rule.
```json
// Request Body
{
  "language": "ru",
  "word": "замок",
  "phonetic_replacement": "з+амок"
}
```

### `DELETE /{entry_id}`
Delete a rule.
```json
// Response (200 OK)
{ "ok": true }
```
