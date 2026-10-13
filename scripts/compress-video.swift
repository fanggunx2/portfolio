// Re-encode a video for the web with macOS's built-in AVFoundation (no ffmpeg needed).
// Output: H.264 + AAC MP4, longest side ≤ maxSide, bitrate chosen so the file stays under targetMB.
//
// Usage: swift scripts/compress-video.swift <input> <output.mp4> [targetMB=20] [maxSide=1280]

import AVFoundation

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("Usage: swift compress-video.swift <input> <output.mp4> [targetMB=20] [maxSide=1280]")
    exit(1)
}
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let targetMB = args.count > 3 ? Double(args[3])! : 20
let maxSide = args.count > 4 ? Double(args[4])! : 1280

let asset = AVURLAsset(url: input)
let semaphore = DispatchSemaphore(value: 0)
var failure: String?

Task {
    do {
        let duration = try await asset.load(.duration).seconds
        guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            failure = "No video track"; semaphore.signal(); return
        }
        let audioTrack = try await asset.loadTracks(withMediaType: .audio).first
        let naturalSize = try await videoTrack.load(.naturalSize)
        let transform = try await videoTrack.load(.preferredTransform)
        let frameRate = try await videoTrack.load(.nominalFrameRate)

        // Scale down so the longest side fits maxSide (dimensions must be even)
        let scale = min(1, maxSide / Double(max(naturalSize.width, naturalSize.height)))
        let width = Int((Double(naturalSize.width) * scale / 2).rounded()) * 2
        let height = Int((Double(naturalSize.height) * scale / 2).rounded()) * 2

        // Bitrate budget: fit targetMB, never above 4 Mbps
        let audioBitrate = 128_000.0
        let videoBitrate = min(4_000_000, (targetMB * 0.95 * 8_000_000 / duration) - audioBitrate)

        try? FileManager.default.removeItem(at: output)
        let reader = try AVAssetReader(asset: asset)
        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        writer.shouldOptimizeForNetworkUse = true

        let videoOut = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        ])
        reader.add(videoOut)
        let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoScalingModeKey: AVVideoScalingModeResizeAspect,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: Int(videoBitrate),
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                AVVideoExpectedSourceFrameRateKey: Int(frameRate.rounded()),
            ],
        ])
        videoIn.transform = transform  // keep portrait videos upright
        videoIn.expectsMediaDataInRealTime = false
        writer.add(videoIn)

        var pairs: [(AVAssetReaderOutput, AVAssetWriterInput)] = [(videoOut, videoIn)]
        if let audioTrack {
            let audioOut = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: [
                AVFormatIDKey: kAudioFormatLinearPCM
            ])
            reader.add(audioOut)
            let audioIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVNumberOfChannelsKey: 2,
                AVSampleRateKey: 44_100,
                AVEncoderBitRateKey: Int(audioBitrate),
            ])
            audioIn.expectsMediaDataInRealTime = false
            writer.add(audioIn)
            pairs.append((audioOut, audioIn))
        }

        reader.startReading()
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        let group = DispatchGroup()
        for (index, (out, input)) in pairs.enumerated() {
            group.enter()
            let queue = DispatchQueue(label: "track\(index)")
            input.requestMediaDataWhenReady(on: queue) {
                while input.isReadyForMoreMediaData {
                    if let sample = out.copyNextSampleBuffer() {
                        input.append(sample)
                    } else {
                        input.markAsFinished()
                        group.leave()
                        return
                    }
                }
            }
        }
        group.notify(queue: .main) {
            writer.finishWriting {
                if writer.status != .completed {
                    failure = writer.error?.localizedDescription ?? "Write failed"
                } else if reader.status == .failed {
                    failure = reader.error?.localizedDescription ?? "Read failed"
                } else {
                    print("\(width)x\(height), \(Int(videoBitrate / 1000)) kbps")
                }
                semaphore.signal()
            }
        }
    } catch {
        failure = error.localizedDescription
        semaphore.signal()
    }
}

// Keep the main run loop alive for the writer's completion callbacks
while semaphore.wait(timeout: .now()) == .timedOut {
    RunLoop.main.run(until: Date().addingTimeInterval(0.1))
}
if let failure {
    print("Error: \(failure)")
    exit(1)
}
