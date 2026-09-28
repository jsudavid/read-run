# 声音控制项目参考

检索日期：2026-09-28

本文汇总公开 GitHub 项目，供早读声音驱动角色运动的小游戏研究参考。检索范围包括音量连续映射、语音/声音事件控制、研究工具、交互装置和声音视觉化，不局限于 Docker 或网页小游戏。

本清单按个人研究学习用途保留公开仓库，包括没有声明许可证的项目。许可证栏只记录仓库元数据或 README 中能看到的信息；没有声明时不推断授权。仓库内容可能变化，本文根据公开仓库页面和 README 整理，未逐一克隆运行。

## 音量控制速度或动作

| 项目 | 输入与行为 | 技术栈 | 许可证与备注 |
|---|---|---|---|
| [vocex-run](https://github.com/ShounakPatra/vocex-run) | 安静时减速，说话时加速，强声音达到最高速度，尖锐声音触发跳跃 | Android、Java | MIT；玩法映射与本项目最接近 |
| [Rowing for the Gold](https://github.com/EduLRG/Rowing-for-the-gold-p5js) | 麦克风声音提升划船速度，对输入做平滑 | 浏览器、JavaScript、p5.js、p5.sound | MIT；网页端音量到速度映射直接易读 |
| [Shouting Chickens](https://github.com/SyedBaqarAbbas/shouting-chickens) | 校准后的声音脉冲触发跳跃，持续发声提供有限升力 | TypeScript、浏览器 PWA | Apache-2.0；包含校准、隐私说明和键盘/触屏后备输入 |
| [soundVisual-Avora](https://github.com/Qrytics/soundVisual-Avora) | 麦克风 RMS 音量给小球加速，静音时摩擦减速 | Next.js、TypeScript、Canvas、Web Audio API | 未检出许可证；可参考音量到加速度/速度的映射 |
| [Chinese Flying Sound Run](https://github.com/xreylab/chinese-flying-sound-run-game) | 唱指定短句起飞；持续发声保持飞行，音调控制高度 | TypeScript、Phaser 3、Web Audio API、Web Speech API | MIT；连续声音和噪声过滤值得参考 |
| [Sparkler Game (Phaser)](https://github.com/taylorjg/sparkler-game-phaser) | 麦克风噪声给火花角色提供向上推力 | TypeScript、Phaser 4、Web Audio API/AudioWorklet | 未检出许可证；浏览器端实时声音驱动运动 |
| [Decibel Dash](https://github.com/SaaiAravindhRaja/Decibel-Dash) | 声音越大跳得越高，带麦克风校准 | HTML、JavaScript、Web Audio API | MIT；README 标注仍在开发中 |
| [ScreamPlane](https://github.com/ScreamPlane/screamplane.github.io) | 用麦克风控制飞机 | JavaScript 网页 | MIT；README 对具体音量映射说明较少 |
| [flappy-shout](https://github.com/tuopouk/flappy-shout) | 浏览器 AudioContext 读取音量并控制小鸟扑翼 | Python Dash、浏览器 Web Audio API | MIT；游戏逻辑在 Python，原始音量从浏览器传入 |
| [voice-control-game](https://github.com/fz-lyu/voice-control-game) | 音量阈值控制跑步和跳跃，可调跑速和跳跃增强值 | Python、Cocos2d、PyAudio | 未检出许可证；2017 年项目，机制说明很直接 |
| [Scream-game](https://github.com/mahmudnibir/Scream-game) | 普通说话前进、大喊跳跃、吹口哨冲刺、哼鸣下蹲，带灵敏度校准 | Python、Pygame | GitHub 元数据未识别许可证；README 声称 MIT |
| [voice-floating-ball-game](https://github.com/mattj23/voice-floating-ball-game) | 响度和气流共同控制球的移动；有校准、试次记录和逐帧数据 | .NET 8、C#、Avalonia | GPL-3.0；发声运动研究工具，需要额外气流传感器 |
| [VoiceJumpGame](https://github.com/RenCheng0525/VoiceJumpGame) | Web Audio 分析音量、音调和舌音；持续发“啊”可保持跳跃 | HTML Canvas、Web Audio API | README 声称 MIT，GitHub 元数据未识别 |
| [volume-endless-runner](https://github.com/nate10j/volume-endless-runner) | 制造声音跳跃，可调输入灵敏度和声音阈值 | 浏览器网页 | 未检出许可证；有在线演示 |
| [COMP131 Volume Controlled T-Rex Game](https://github.com/Di1113/COMP131_VolumeControlledTRexGame) | 麦克风音量控制小恐龙风格游戏 | Java | 未检出许可证 |
| [flying_pig](https://github.com/lucyli0609/flying_pig) | 音量控制飞猪游戏 | Python | 未检出许可证；项目说明较简略 |
| [voice-controlled-flappy-Men_Game](https://github.com/Bhushan791/voice-controlled-flappy-Men_Game) | 通过音量和音调控制角色飞行 | JavaScript 网页 | 未检出许可证 |
| [MKS22X-ScreamingGame](https://github.com/gregzb/MKS22X-ScreamingGame) | 麦克风控制的平台跳跃游戏 | Processing | 未检出许可证 |
| [swift3-audiokit-sample-game](https://github.com/grimlockrocks/swift3-audiokit-sample-game) | 将声音响度作为游戏输入 | Swift、iOS、AudioKit | 未检出许可证；适合了解原生移动端做法 |
| [VoiceControlledCar](https://github.com/matthiaszarzecki/VoiceControlledCar) | 通过发声控制赛车 | C# | 未检出许可证；README 细节较少 |

## 声音分类、语音指令和音高控制

这些项目同样使用声音作为输入，但多数识别特定声音或词语，不是按音量连续调速。

| 项目 | 输入与行为 | 技术栈 | 许可证与备注 |
|---|---|---|---|
| [sound-controlled-intergalactic-teddy](https://github.com/lassse/sound-controlled-intergalactic-teddy) | 训练声音分类器识别“哦”声和拍手，可训练自己的样本 | JavaScript、浏览器、机器学习分类 | 未检出许可证 |
| [SoundMaze](https://github.com/0xHericles/SoundMaze) | 可训练声音类别的声控迷宫 | JavaScript、TensorFlow.js | MIT |
| [Phaser3-RunnerGame](https://github.com/SimonBryatov/Phaser3-RunnerGame) | 跺脚跑步、拍手跳跃 | Phaser、JavaScript/TypeScript | 未检出许可证；声音事件控制 |
| [phaser-test / Tobu](https://github.com/debelopumento/phaser-test) | 通过语音识别触发跳跃 | Phaser、React、Redux、Web Speech API | MIT；识别词语而非测量音量 |
| [SpeechRecognitionGame](https://github.com/Nk095291/SpeechRecognitionGame) | Phaser 3 收集金币游戏，支持语音操作 | Phaser 3、JavaScript | 未检出许可证；具体声音映射说明较少 |
| [Voice Command City Walk](https://github.com/autistic-wiring/voice-command-city-walk) | 语音指令控制走、跑、跳等动作 | Vanilla JavaScript、Web Speech API | MIT；浏览器语音命令示例 |
| [hci-snake-game](https://github.com/joy-andraos/hci-snake-game) | 用 “up/down/left/right” 语音指令控制贪吃蛇，也支持手势 | 浏览器、TensorFlow.js | 未检出许可证；HCI 多模态输入示例 |
| [Voice-Controlled-Gaming](https://github.com/whyRahull/Voice-Controlled-Gaming) | 将语音指令转换为键盘输入，可控制其他游戏 | Python | 未检出许可证；通用语音到键盘的桥接工具 |
| [pitchy-per](https://github.com/pannacotta98/pitchy-per) | 用音高控制滑板车移动 | JavaScript、Phaser、谐波乘积谱 | 未检出许可证；控制特征是音高而非响度 |

## 研究工具、交互装置和声音视觉化

| 项目 | 用途 | 技术栈 | 许可证与备注 |
|---|---|---|---|
| [Qubey](https://github.com/tkex/qubey) | Arduino 声音传感器和陀螺仪向 Unity 提供输入，可用于游戏、模拟、康复和学习训练 | Arduino、Unity、C#、MAX9814 | AGPL-3.0；声音阈值可配置并触发自定义动作 |
| [FastLED-SoundReactive](https://github.com/atuline/FastLED-SoundReactive) | 麦克风驱动灯光动画；包含底噪抑制、自动增益、采样平均和峰值检测 | Arduino、ESP8266、C/C++、FastLED | 许可证状态未确认；信号平滑思路可参考 |
| [ESP32 LED Sound Reactive System](https://github.com/hyutrn/ESP32_Led_Sound_Reactive_System_with_OLED_Display) | 麦克风音量控制 LED 亮度和灯光模式 | ESP32、Arduino、OLED | README 称 MIT |
| [VoiceOrbs](https://github.com/amunozdev/voiceorbs) | React 语音助手动画组件，可用实时音量驱动动画强度 | React、TypeScript、Canvas/CSS | MIT；适合参考实时音量反馈 UI |
| [Feels](https://github.com/kumanday/feels) | 麦克风示波器和频谱图，支持增益与 FFT 参数调节 | React、Web Audio API | 许可证状态未确认 |
| [DrawnBySound](https://github.com/ruishinor/DrawnBySound) | 用麦克风或音频文件把声音绘制成实时动态图形 | WebGL2、音频特征分析 | 许可证状态需查看仓库 |
| [passive-sound-localization](https://github.com/robotsasfurniture/passive-sound-localization) | 多麦克风定位和语音指令驱动 ROS2 机器人移动 | Python、ROS2、多麦克风、语音/AI | 未确认许可证；声源定位和语音命令路线，不是音量映射 |

## 对本项目的参考顺序

当前项目使用 Vite、JavaScript 和 Three.js，见 [package.json](../package.json)。网页按 [Cloudflare Pages 部署说明](CLOUDFLARE-PAGES.md) 静态发布，麦克风音频与本地选择的照片都由浏览器处理，无需服务端中转。开发时可用 `localhost`；公网部署按 [ADR-0001](adr/0001-cloud-online-architecture.md) 使用 HTTPS。音频仍留在本机，见 [REQUIREMENTS-DELTA.md](REQUIREMENTS-DELTA.md)。

建议优先阅读：

1. `Rowing for the Gold`：浏览器端麦克风输入提高移动速度，和当前技术栈最接近。
2. `Shouting Chickens`：参考发声校准、短促声音触发、持续发声保持运动和输入后备方案。
3. `vocex-run`：参考安静减速、持续发声加速、强声达到最高速度的玩法映射。
4. `Sparkler Game` 和 `Chinese Flying Sound Run`：参考浏览器实时声音驱动连续运动。
5. `voice-floating-ball-game`：参考响度标定、发声实验流程和逐帧数据记录。
6. `FastLED-SoundReactive`：参考噪声底、平滑和自动增益方法。

## 与早读场景的关系

项目术语表将“声量强度”定义为全班朗读整体响度的归一化度量，并以“连续达标”抵消咳嗽、桌椅碰撞等短时干扰，见 [CONTEXT.md](../CONTEXT.md)。相关实现说明还记录了底噪自适应、快起慢落、软饱和归一和短尖峰过滤，见 [REQUIREMENTS-DELTA.md](REQUIREMENTS-DELTA.md)。因此，外部项目更适合用来对照速度/距离映射、持续时长反馈、校准界面和可视反馈，未必需要整体移植其音频采集链路。

一个麦克风能反映全班所在拾音位置的整体声场，但不能从声量判断某位学生是否持续朗读。不同教室、麦克风增益、设备距离和环境噪声也会改变读数，适合结合底噪自适应和灵敏度校准处理。
