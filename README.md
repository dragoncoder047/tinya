# TinyA

<!-- markdownlint-disable single-h1 heading-increment no-trailing-punctuation -->

TinyA is a simple, versatile, and opinionated Javascript/Typescript library for playing a wide range of 8-bit videogame style sound effects and music.

TinyA is inspired by [BeepBox][], [ZzFX][], and [ZzFXM][], and but is not related to any of those, is completely incompatible, and is most certainly larger than ZzFXM (you wouldn't want to use TinyA in a js13k game even though it is small. It's not *that* small compared to ZzFXM.)

[ZzFX]: https://github.com/KilledByAPixel/ZzFX
[ZzFXM]: https://github.com/keithclark/ZzFXM
[BeepBox]: https://github.com/johnnesky/beepbox

> [!IMPORTANT]
> If you want to port TinyA to another language, it **must** support IEEE-754 signed zeros. TinyA uses the sign bit to denote different behaviors even in places where the rest of the value can be zero. You have been warned.
>
> Javascript does, but JSON does not, so TinyA provides its own encoding and decoding wrappers (see below).

## General topology

To be able to create the maximum variety of sound effects, TinyA implements a highly configurable audio pipeline, which can create many different sound effects.

The core of TinyA is an *instrument*, which is a graph of functions that pass values to each other. The nodes themselves are allowed to store state; this is accomplished using Javascript lexical closures.

When the sound is to be played, the remaining inputs to the graph are filled with *input channels*, which are a time-tagged sequence of values and interpolations between them. This creates, along with the instrument, a zero-input one-output graph. The output is, naturally, the current sample. The graph is stepped once for each sample.

## Notation of Graph

The graph is defined as a nested list structure. Each node is written as the node type specifier, followed by its inputs.

The node can optionally start with a string beginning with `=`. This names the node, which enables it to be referenced by other nodes. This is removed if present, and then the rest of the array is processed as if it was a normal unnamed node.

The node type specifier can be one of two things:

1. A string. This specifies the type of the node, initialized with no arguments.
2. An array with a string as the first element. This specifies both the type of the node and the arguments used to initialize it (Some nodes have initialization-time arguments that can't be passed in as a audio-rate parameter.)

Each of the parameter values (which come after the function) can be one of four things:

1. Another node. This is an array with a name or function ID as its first element, and the rest are (recursively) one of these too.
2. A reference to another node, which is the name the node was named with but starting with `.` instead of `=`.
3. A reference to an external input channel. This is the same as referencing a node except it starts with `>`.
4. A constant number, undefined, null, or a string that doesn't start with `.`, `=`, or `>`. This is just fed into the parameter as-is for the entire duration of the sound. Null is replaced with zero; undefined is left as-is (the function may have another default).

Note: if you use names to reference to a node lower in the tree (that will be evaluated after the parameter is needed), the parameter value will be zero for the first sample and then it will be the value computed on the previous sample. TinyA will not do anything about this.

For example:

```js
[
    "f", // filter node
    [ // filter cutoff frequency
        "g", // gain node
        -1000, // base value (of frequency)
        [ // multiplied by
            "e", // envelope node
            ".wah", // get value of node named "wah" below
        ]
    ],
    [ // audio input to filter
        "=wah", // name node "wah"
        "g", // gain node
        ">expression", // gain value = expression input channel
        [ // audio input value
            "u", // unison macro
            [ // wave 1
                "w", // wave node
                ">pitch", // frequency = input pitch channel
            ],
            3, // num voices
            .05, // semitones offset between voices
        ]
    ]
]
```

## Notation of Input Channel

<!-- TODO: rework this all !!!!!!! -->

The input channel list is most likely used for stuff like pitch bend, articulation, tempo, EQ, and envelope, but it's not locked to anything like that.

Each input channel list is a list of time slices, and each slice is composed of three numbers: the length of the time slice, a parameter $p$ that controls the level of easing, and the ending value at the end of the window. The easing between the current value and the ending value is described by the following piecewise function:

$$
f\left(t\right)=\begin{cases}
a+\left(b-a\right)\left(\frac{t}{d}\right)^{p},&p\ge0\\
b+\left(a-b\right)\left(\frac{d-t}{d}\right)^{-p},&p\lt0
\end{cases}
$$

where $a$ is the starting value, $b$ is the ending value, $d$ is the duration of the slice, and $t$ is the time since the start of the slice.

Some values for $p$:

* 0: step change. The value is just set to $b$ and remains there for the duration of the slice.
* 1 or -1: Straight linear slide.
* 2: Quadratic ease-out.
* 3: Cubic ease-out.
* -2: Quadratic ease-in.
* -3: Cubic ease-in.

If the value for $p$ is not given it is assumed to be 1. If the value for $d$ is 0 the whole thing degenerates into a step change.

The starting value is assumed to be 0, and if the ending value is omitted, it is also assumed to be 0. The time value is required in each and cannot be undefined (but it is allowed to be zero).

For example:

```js
[
    1, , 10, // linear ramp over 1 second from 0 to 10
    .5, , 10, // stay at 10 for 1/2 second (the p value doesn't matter here)
    2, 2, 15, // quadratic ease-out form 10 to 15 over 2 seconds
    2, -2, 20, // quadratic ease-in from 15 to 20 over 2 seconds
    3 // linear ramp from 20 to 0 over 3 seconds (end of sequence)
]
```

## TinyA API (as of right now) in the order you'll probably use the functions in a typical setting (I think)

(These all assume you do `import * as tinya from "tinya"` or `const tinya = require("tinya");` to start with.)

**`tinya.minparse(compressedString)` -> some object<br>**
**`tinya.minstringify(object)` -> string<br>**
This is a thin wrapper around JSON.parse() that adds a few enhancements: it applies a few transformations to the output to greatly compress it (replacing `0.1` with `.1`, changing `true` to `!0` and `false` to `!1`, removing the quotes around alpabetic strings) as well as a tweak that allows both positive and negative zero to be stringified and parsed correctly.

**`tinya.macroexpand(object, macros)` -> macro-expanded object<br>**
`macros` is an object mapping macro names to their implementation (which is just a function). This will recursively walk the tree of the object (both objects and arrays are walked into) and if it's an array and the first element is a string that is the name of a macro, it will call the macro function with the rest of the elements as arguments; if it doesn't name a macro it will recurse on all of the elements and return the modified array. If the macro returns another container type, macroexpand will be called recursively on whatever the macro returned.

**`tinya.compileInstrument(instrument, nodeDefs, sampleRate=44100)` -> compiled instrument array<br>**
This just "compiles" the instrument down into a representation that is a little faster to run (it will be run once for each sample, and we're potentially generating *thousands* of samples). `nodeDefs` is a mapping of node name to the factory function that creates it. The factory function will get the sample rate as its first parameter, and the remaining arguments are whatever was given in the node definition (case 2 for the head). The factory must return another function that implements the node's DSP code. This will be called once for each sample, with the sample number as the first parameter, and the rest of the parameters are the arguments specified in the node definition (which may be an input sample, a control parameter, etc. and this only depends on the node definition, TinyA doesn't care what these actually mean).

**`tinya.channelDuration(channel)` -> length of channel in seconds<br>**
Given a channel array as specified above, takes all of the time values from each slice and returns their sum which is the total amount of time that the channel will be active.

**`tinya.buildSamples(instrument, channels, duration, sampleRate=44100)` -> array of samples<br>**
`instrument` is the thing that compileInstrument() returned. `channels` is a mapping of channel name to channel array. `duration` is in seconds.

**`tinya.toBufferNode(samples, audioCtx, sampleRate=44100)` -> AudioBufferSourceNode<br>**
Puts the samples into a Web Audio buffer node and returns the audio node. The node isn't connected to anything and isn't started automatically. To play it directly call `node.connect(audioCtx.destination); node.start();`. For stereo output the samples parameter can also be a 2-element array with 2 arrays of samples but there's nothing here that uses that yet.

(TODO: write the predefined node types, macros, etc. here)

---

# Everything below this line is unimplemented and will be moved above it once it's added

so I joined the [beepbox modding discord server](https://discord.com/invite/Tc997TstJb) and i guess if you have any questions about this repository you can ask them there

## consider these TODO items

### Special channels for music: BPM, envelopes/articulation, feed-through timing

(I typed this up as though I was going to implement it and then didn't. Oops! Here's to more free time...)

As TinyA is intended to create not only sound effects, but music, there are special invalid  values placed at the beginning that will tell TinyA that the input channel timing array means something else.

1. If the first element of the channel array is undefined and the rest are positive or undefined, this means the channel array is a tempo-based array. Instead of seconds for the time value and any other arbitrary value for the value, the time becomes beats and the output value becomes BPM, and the beats time value is relative to the current BPM. The "output" of this channel is then the beat count.

    Example:

    ```js
    [
        , // undefined to put it in tempo mode
        24, 0, 120, // start at 120 BPM, hold for 24 beats
        4, , 130, // linearly poco accelerando over 4 beats
        3.75, 0, 60, // suddent molto ritardando, 60 BPM for 3.75 beats
        .25, 0, 3, // basically a fermata (hold last 16th node at 3 BPM)
        32, 0, 120 // a tempo for the rest of the song
    ]
    ```

2. If the first element is a negative number (which would normally make no sense -- how could something last for negative time), it instead means that the channel is relative to the output of channel -N. So for example, you could list the "conductor" channel first (at index 0) which controls the tempo and BPM, and song data channels could be relative to this (using beat count rather than wall time for timing); they would all start with -0.

3. If the first three elements begin with undefined and a negative number, this means that it is a "articulation" or resetting per-note channel. The negative number means the same thing as in case 2 (which channel to use as a gate input), and the third value is the behavior parameter which is a number or undefined:
    * undefined or 0: modulation is disabled; timer resets when input goes to zero
    * 1: modulation is disabled; timer resets when input changes
    * 2: modulation value **adds** to the output value; timer resets when input goes to zero
    * 3: modulation **multiplies** output; timer resets when input changes
    * 4: modulation **multiplies** output; timer resets when input goes to zero
    * 5: modulation **multiplies** output; timer resets when input goes to zero or changes

    The behavior of the timer is controlled by the input as follows
    * At the start, the internal timer is set to 0.
    * The internal timer remains 0 and the t=0 value is outputted until the input changes away from 0 (only if behavior = 0, 3, 4, or 5).
    * When the input changes and triggers a reset, the internal timer starts and the value is output (with modulation, if enabled).
    * When the shaper reaches a time slice with a negative time value, the internal timer stops and the value specified by that slice is "held" (before modulation).
    * When the input value goes to 0 again the timer continues to the end of the sequence and then resets to 0 again and stops.

    For example, here is how to create an ADSR envelope channel:

    ```js
    [
        , -3, , // make it an articulation channel using channel 3 as a gate
        .05, , 1, // attack time = 50 ms
        .1, , .9, // decay time = 100 ms, systain volume = 90%
        -1, , .9, // sustain (volume here should be the same as decay slice to prevent a step change)
        .2 // release time = 200 ms
    ]
    ```

## Other ideas that haven't been well thought out

* Remove all the places where negative zero is used so TinyA can be ported to languages that don't have signed zeros.

* Implement a generalized FM instrument macro (also once I figure out how BeepBox does it).

* Have a node that converts MIDI note number into frequency
    * This would kind of fix it to 12-EDO because it would need extremely ugly decimals for microtonal that is not a multiple of 12
        * Auto-fraction may fix this, the fractions might work out nice. Or not.

* Make the "compressed JSON" parser able to parse fractions like 1/16 so people can more easily hand-write stuff without having to break out a calculator (also `.0625` is a tad longer than `1/16` and gets worse as the fraction gets smaller). Maybe also have the stringifier detect likely fractions and do this too. [Relevant StackOverflow question](https://stackoverflow.com/questions/26643695/converting-a-floating-point-decimal-value-to-a-fraction)

* Make TinyA capable of streaming output (being able to play some sound before all samples are generated). Need to figure out how to reify buildSamples' internal state.

* Be able to specify more than one channel value in the same array. This would be conducive to, say, encoding an entire track of a song (note pitch, articulation, dynamics, "muting" a horn, etc.) with the values at the same timestep right next to each other in the array, and the lengths are re-used, so stuff stays in sync.
    * This would mean that the single channel outputs an array, so the input reference needs to specify which index (possibly using the first number)
        * It could just be a macro that outputs things
        * Either that or the outputs of the channel have to be named

* Implement a few more nodes to allow me to implement the rest of the functionality of ZzFX so that TinyA can act as a backend of ZzFX compatibility.

    Current capabilities:
    * Basic oscillator (using the built-in oscillator node) with 5 wave shapes, shape curve, and noise
    * Filter (dedicated node)
    * Bitcrusher (dedicated node)
    * ADSR (using input channel or fake node and manual duration)
    * Echo/flanger delay (dedicated node)
    * Tremolo (using another sinewave oscillator and some offsets)
    * Modulation (using another sinewave oscillator and a π/2-radian phase offset since it's supposed to be cosine not sine)
    * Pitch jump (using the frequency input channel) but only if repeatTime is 0 (and if slide and deltaSlide are not zero will need to split the frequency into sum of 2 channels to make math easier)

    Need to implement:
    * The math that turns the slide and deltaSlide parameters into two quadratic channel inputs (of the frequency channel). Should be easy once I look at the math in Desmos.
    * A "clock" node that outputs all 0's except for a single-sample 1 when an internal counter rolls over (counter is controlled by wall time or by an input)
    * An integrator that sums up its input, with an initial value. (optionally with upper and lower wrap and clamp limits and a reset).
        * This could be initialized to the base frequency, and "clock" could then multiply by the pitchJump amount and be sent through a delay line (pitchJumpTime length) into the integrator

    * Maybe also make a ZzFXM importer and renderer.

* Some more kinds of math nodes.
    * A selector node that takes N+1 inputs and uses the first % N to select which input (this could be used with a clock and integrator combination to do the arpeggiation thing from BeepBox)
    * Greater-than, less-than, etc

* Maybe also have possible values going around be arrays of numbers
    * Have a node that can tell the length
    * This would simplify the BeepBox arpeggiation if the pitch channel output can output an array

* :smiley: :smiley: :smiley: Make a BeepBox fork that uses TinyA as a backend and lets people edit the instrument graph visually, and then export to some compressed-JSON string that can be sent to a dedicated renderer
