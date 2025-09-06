
// const ZZFX_SAMPLE_RATE = 48000; // normally was 44.1 kHz but the default Web Audio sample rate seems to be 48 kHz now??
// // console.log(new AudioContext().sampleRate)

// const ZZFX_MASTER_GAIN = .3;

// const zzfxSamples = (
//     volume = 1,
//     randomness = .05,
//     frequency = 220,
//     attack = 0,
//     sustain = 0,
//     release = .1,
//     shape = 0,
//     shapeCurve = 1,
//     slide = 0,
//     deltaSlide = 0,
//     pitchJump = 0,
//     pitchJumpTime = 0,
//     repeatTime = 0,
//     noise = 0,
//     modulation = 0,
//     bitCrush = 0,
//     delay = 0,
//     sustainVolume = 1,
//     decay = 0,
//     tremolo = 0,
//     filter = 0
// ) => {
//     volume *= ZZFX_MASTER_GAIN;
//     slide *= 500;
//     deltaSlide *= 500;
//     bitCrush *= 100;
//     const playDuration = attack + decay + sustain + release;
//     const totalDuration = playDuration + delay;
//     // order is (pitch slide & pitch jump) --> modulation --> osc --> tremolo --> adsr --> delay --> filter --> bitcrusher
//     var jumpOutput: NodeParameter | undefined;
//     var rc: any;
//     const getResetClock = (): NodeParameter => {
//         if (!rc)
//             return rc = ["c", repeatTime] as NodeParameter;
//         if (rc[0] != "=rc")
//             rc.unshift("=rc");
//         return "@rc";
//     }
//     // this logic is a mess
//     if (pitchJump) {
//         var jumpNode: NodeParameter | undefined;
//         if (repeatTime) {
//             // account for pitch jump having to roll over first
//             // before it can be restarted by repeat
//             var temp = repeatTime;
//             while (temp < pitchJumpTime)
//                 temp += repeatTime;
//             jumpNode = [["i", , 0], ["g", pitchJump, ["c", temp]]];
//         }
//         else
//             jumpNode = pitchJump;
//         if (pitchJumpTime)
//             jumpOutput = ["d", pitchJumpTime, , jumpNode];
//         else
//             jumpOutput = jumpNode;
//     }
//     var slideNode: NodeParameter | undefined;
//     if (slide || deltaSlide) {
//         var deltaSlideNode: NodeParameter | undefined;
//         if (deltaSlide)
//             deltaSlideNode = [["i", slide], deltaSlide];
//         else
//             deltaSlideNode = slide;
//         slideNode = ["i", deltaSlideNode];
//         if (repeatTime) {
//             slideNode[2] = getResetClock();
//             slideNode[3] = 0;
//             if (isArray(deltaSlideNode)) {
//                 deltaSlideNode[2] = getResetClock();
//                 deltaSlideNode[3] = slide;
//             }
//         }
//     }
//     const randFreqNode = ["sh", frequency, randomness];
//     const freqNode = !isUndefined(jumpOutput) || !isUndefined(slideNode)
//         ? ["a", randFreqNode, jumpOutput, slideNode].filter(n => !isUndefined(n))
//         : randFreqNode;
//     const modFreqNode = modulation !== 0 ? ["g", freqNode, ["w", modulation, , , , .25]] : freqNode;
//     const oscNode = ["w", modFreqNode, shape, shapeCurve, noise];
//     const tremoloNode = repeatTime > 0 && tremolo > 0 ? ["a", 1 - tremolo, ["g", tremolo, ["w", 1 / repeatTime, , , , .5]]] : undefined;
//     const adsrNode = [["ch", makeADSRChannel(attack, decay, sustain, sustainVolume, release)]];
//     const gainedOscNode = ["g", oscNode, tremoloNode, adsrNode].filter(n => !isUndefined(n));
//     const delayedNode = delay > 0 ? ["a", ["g", .5, gainedOscNode], ["g", ["d", delay, , "@di"], .5, [["ch", [0, 1, playDuration, 1, delay]]]]] : gainedOscNode;
//     const filteredNode = filter ? ["f", filter, delayedNode] : delayedNode;
//     const bitcrushedNode = bitCrush ? ["b", bitCrush, filteredNode] : filteredNode;
//     if (delay > 0) bitcrushedNode.unshift("=di");
//     const masterGainNode = ["g", volume, bitcrushedNode];
//     return buildSamples(compileInstrument(masterGainNode as any, builtinNodes), {}, totalDuration, ZZFX_SAMPLE_RATE);
// }
