
Player is in 2 parts: the sequencer, and the synthesizer

The sequencer runs in the main thread, on a setInterval loop. On every tick it sends a list of `[startBeat, pitch, expression]` to the synthesizer. The synthesizer is a Web Audio `AudioWorkletNode` that sends the notes to the associated `AudioWorkletProcessor` via the message port.

TODO: figure out how to design the logic for the chord type processing
