
ZzFXM format:

> ```js
> [                                     // Song
>   [                                     // Instruments
>     [.9, 0, 143, , , .35, 3],             // Instrument 0
>     [1, 0, 216, , , .45, 1, 4, , ,50],    // Instrument 1
>     [.75, 0, 196, , .08, .18, 3]          // Instrument 2
>   ],
>   [                                     // Patterns
>     [                                     // Pattern 0
>       [                                     // Channel 0
>         0,                                    // Using instrument 0
>         -1,                                   // From the left speaker
>         1,                                    // play C-1
>         0, 0, 0,                              // rest (x3)
>         3.5,                                  // play E-1 with 50% attenuation
>         0, 0, 0                               // rest (x3)
>       ],
>       [                                     // Channel 1
>         1,                                    // Using instrument 1
>         1,                                    // From the right speaker
>         2,                                    // play D-1
>         2.25,                                 // play D-1 with 25% attenuation
>         3.5,                                  // Play E-1 with 50% attenuation
>         4.75,                                 // Play F-1 with 75% attenuation
>         -1,                                   // Release the note
>         0, 0, 0                               // rest (x3)
>       ]
>     ]
>   ],
>   [                                     // Sequence
>     0,                                    // Play pattern 0
>     0,                                    // ...and again
>   ],
>   120,                                  // 120 BPM
>   {                                     // Metadata (ignored)
>     title: "My Song",                      // Name of the song
>     author: "Keith Clark"                  // Name of the author/composer
>   }
> ]
> ```

so basically

```ts
type Song = [
    instruments: Instrument[],
    patterns: Pattern[],
    patternSequence: number[],
    bpm: number,
    metadata?: Metadata,
];
type Pattern = Channel[];
type Channel = [
    instrument: number,
    pan: number,
    ...notes: NoteEvent[]
];
type NoteEvent = Note | NoteOff | Filler;
type Note = MIDINote + (1 - Expression);
type NoteOff = -1;
type Filler = 0 | undefined;
```

# New Beepbox-like format

```ts
type Song = [
    metadata: Metadata,
    instruments: Instrument[],
    bars: Bar[],
    barGrid: number[][],
    initialTempo: number,
    postprocess: AudioNodeDefinition, // for stuff like limiter and eq
];
type Metadata = {
    title: string;
    author?: string;
    authorURL?: string;
    comment?: string;
    license?: string;
    instrumentNames?: string[];
    tuning?: {
        rootN?: [noteNo: number, Hz: number]; // defaults to [69, 440] (standard A4)
        edo?: number; // defaults to 12 obviously. If it is not 12 then it is the number of notes per octave
        octRatio?: number; // defaults to 2 obviously
    };
};
type InstrumentName = number | string; // string if metadata uses instrument names
type Bar = [
    barLength: number, // in beats
    ...Note[]
];
type Note = [
    instrument: InstrumentName | ModIndex
    nextOffset: number, // in beats
    pitchBase: number,
    ...([
        pinOffset: number, // in beats
        end: NotePin,
        // repeat last two if there are more than 3 pins
    ] | [
        [shapeBar: number | undefined, shapeNoteIndex: number]
    ]);
];
type NotePin = [pitchBend: number | undefined, expression: number | undefined];
type ModIndex = [
    target: ModTarget,
    which: number | string,
];
type ModTarget = InstrumentName | undefined;
    // instrument name or number >=0 = instrument index
    // undefined = global song effects incl tempo
    // if it's a mod, the notePin is just taken as a verbatim number which is multiplied with the set value
type Instrument = AudioNodeDefinition;

// see network.md
type AudioNodeDefinition = string;
```
