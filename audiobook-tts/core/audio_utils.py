from pydub import AudioSegment
from pydub.effects import normalize

def stitch_wavs(input_files, output_file):
    """Stitches multiple wav files together and normalizes the volume."""
    if not input_files:
        return

    combined = AudioSegment.empty()
    for infile in input_files:
        audio = AudioSegment.from_wav(infile)
        combined += audio
        
    # Apply peak normalization to prevent volume drops
    normalized = normalize(combined)
    
    # Export the final stitched and normalized audio
    normalized.export(output_file, format="wav")

def normalize_wav(file_path):
    """Normalizes a single wav file in-place."""
    audio = AudioSegment.from_wav(file_path)
    normalized = normalize(audio)
    normalized.export(file_path, format="wav")
