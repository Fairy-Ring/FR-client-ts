import { playWave, replayWave, setWaveVolume } from '#3rdparty/audio.js';
// Decision 012: Jagex control plane + Spessa (Florestan bank) — single product backend
import { stopMidi, setMidiVolume, playMidi } from '#/sound/MidiFacade.js';

import ClientBuild from '#/client/ClientBuild.js';
import { ClientCode } from '#/client/ClientCode.js';
import GameShell from '#/client/GameShell.js';
import { MiniMenuAction } from '#/client/MiniMenuAction.js';
import MobileKeyboard from '#/client/MobileKeyboard.js';
import MouseTracking from '#/client/MouseTracking.js';
import Skill from '#/client/Skill.js';
import TitleFlames from '#/client/TitleFlames.js';

import FloType from '#/config/FloType.js';
import SeqType, { PostanimMove, PreanimMove, RestartMode } from '#/config/SeqType.js';
import LocType from '#/config/LocType.js';
import ObjType from '#/config/ObjType.js';
import NpcType from '#/config/NpcType.js';
import IdkType from '#/config/IdkType.js';
import SpotType from '#/config/SpotType.js';
import VarpType from '#/config/VarpType.js';
import VarBitType from '#/config/VarBitType.js';
import IfType from '#/config/IfType.js';
import { ComponentType, ButtonType } from '#/config/IfType.js';

import ClientEntity from '#/dash3d/ClientEntity.js';
import ClientLocAnim from '#/dash3d/ClientLocAnim.js';
import ClientNpc, { NpcUpdate } from '#/dash3d/ClientNpc.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientPlayer, { PlayerUpdate } from '#/dash3d/ClientPlayer.js';
import ClientProj from '#/dash3d/ClientProj.js';
import CollisionMap, { BuildArea } from '#/dash3d/CollisionMap.js';
import { CollisionFlag } from '#/dash3d/CollisionFlag.js';
import { DirectionFlag } from '#/dash3d/DirectionFlag.js';
import { LocAngle } from '#/dash3d/LocAngle.js';
import LocChange from '#/dash3d/LocChange.js';
import { LocLayer } from '#/dash3d/LocLayer.js';
import { LocShape, LOC_SHAPE_TO_LAYER } from '#/dash3d/LocShape.js';
import { MapFlag } from '#/dash3d/MapFlag.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import World from '#/dash3d/World.js';

import JString from '#/datastruct/JString.js';
import LinkList from '#/datastruct/LinkList.js';

import { Int32Array2d, TypedArray1d, TypedArray3d, Int32Array3d, Uint8Array3d } from '#/util/Arrays.js';
import { downloadUrl, sleep } from '#/util/JsUtil.js';

import AnimFrame from '#/dash3d/AnimFrame.js';
import { canvas2d } from '#/graphics/Canvas.js';
import { Colour } from '#/graphics/Colour.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Model from '#/dash3d/Model.js';
import Pix8 from '#/graphics/Pix8.js';
import Pix32 from '#/graphics/Pix32.js';
import PixFont from '#/graphics/PixFont.js';
import PixMap from '#/graphics/PixMap.js';

import ClientStream from '#/io/ClientStream.js';
import { ClientProt } from '#/io/ClientProt.js';
import { writeCameraPosition, writeCycleLogic6, writePrivateMessage, writePublicChat, writeReportAbuse, writeSynthError } from '#/io/ClientOutbound.js';
import Database from '#/io/Database.js';
import Isaac from '#/io/Isaac.js';
import JagFile from '#/io/JagFile.js';
import Packet from '#/io/Packet.js';
import OnDemand from '#/io/OnDemand.js';
import { ServerProt, ServerProtSizes } from '#/io/ServerProt.js';

import { reverseDnsLookup } from '#/util/WebDns.js';

import WordFilter from '#/wordfilter/WordFilter.js';
import WordPack from '#/wordfilter/WordPack.js';

import JagFX from '#/sound/JagFX.js';

// LC-rs2-r377: target engine ENGINE_REVISION=377 (base clone was Client-TS 289)
const CLIENT_VERSION = 377;

const MAX_PLAYER_COUNT = 2048;
const LOCAL_PLAYER_INDEX = 2047;

function allocSceneMapRegion(): number[][][] {
    const region: number[][][] = new Array(4);
    for (let level = 0; level < 4; level++) {
        region[level] = new Array(13);
        for (let y = 0; y < 13; y++) {
            region[level][y] = new Array(13).fill(-1);
        }
    }
    return region;
}

const MAX_CHATS = 50;
const CHAT_COLOURS = [Colour.YELLOW, Colour.RED, Colour.GREEN, Colour.CYAN, Colour.MAGENTA, Colour.WHITE];

const SCROLLBAR_TRACK = 0x23201b;
const SCROLLBAR_GRIP_FOREGROUND = 0x4d4233;
const SCROLLBAR_GRIP_HIGHLIGHT = 0x766654;
const SCROLLBAR_GRIP_LOWLIGHT = 0x332d25;

export class Client extends GameShell {
    static nodeId: number = 10;
    static memServer: boolean = true;
    static lowMem: boolean = false;

    static cyclelogic1: number = 0;
    static cyclelogic2: number = 0;
    static cyclelogic3: number = 0;
    static cyclelogic4: number = 0;
    static cyclelogic5: number = 0;
    static cyclelogic6: number = 0;
    static cyclelogic7: number = 0;
    static cyclelogic8: number = 0;
    static cyclelogic9: number = 0;
    static cyclelogic10: number = 0;
    /** Java signlink.reporterror; true emits the failing wave id, false emits -1. */
    static reportErrors: boolean = true;

    static oplogic1: number = 0;
    static oplogic2: number = 0;
    static oplogic3: number = 0;
    static oplogic4: number = 0;
    static oplogic5: number = 0;
    static oplogic6: number = 0;
    static oplogic7: number = 0;
    static oplogic8: number = 0;
    static oplogic9: number = 0;
    static oplogic10: number = 0;

    static loopCycle: number = 0;
    static drawCycle: number = 0;

    static CHARSET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!\"£$%^&*()-_=+[{]};:'@#~,<.>/?\\| ";

    static readbit = new Int32Array(32);
    static levelExperience: number[] = [];

    static {
        let n = 2;
        for (let bit = 0; bit < 32; bit++) {
            Client.readbit[bit] = n - 1;
            n += n;
        }

        let acc: number = 0;
        for (let i: number = 0; i < 99; i++) {
            const level: number = i + 1;
            const delta: number = (level + Math.pow(2.0, level / 7.0) * 300.0) | 0;
            acc += delta;
            Client.levelExperience[i] = (acc / 4) | 0;
        }
    }

    private alreadyStarted: boolean = false;
    private errorStarted: boolean = false;
    private errorLoading: boolean = false;
    private errorHost: boolean = false;
    private errorMessage: string | null = null;
    private lastProgressPercent: number = 0;
    private lastProgressMessage: string = '';

    ingame: boolean = false;

    private prevMouseClickTime: number = 0;
    private mouseTracked: boolean = false;
    private mouseTracking: MouseTracking = new MouseTracking(this);
    private mouseTrackingInterval: ReturnType<typeof setInterval> | null = null;
    private mouseTrackedX: number = 0;
    private mouseTrackedY: number = 0;
    private mouseTrackDelta: number = 0;
    private focusIn: boolean = false;

    private showFps: boolean = false;
    private rebootTimer: number = 0;

    private hintType: number = 0;
    private hintNpc: number = 0;
    private hintPlayer: number = 0;
    private hintTileX: number = 0;
    private hintTileZ: number = 0;
    private hintHeight: number = 0;
    private hintOffsetX: number = 0;
    private hintOffsetZ: number = 0;

    private lastAddress: number = 0;
    private dnsReq: string | null = null;
    /** Java `previousLoginDay` — absolute day id; delta = currentDay - previousLoginDay. */
    private previousLoginDay: number = 0;
    /** Java `currentDay` from LAST_LOGIN_INFO. */
    private currentDay: number = 0;
    /** Java `daysSincePasswordChanged` (absolute day, or sentinel). */
    private daysSincePasswordChanged: number = 0;
    /** Java `recoveriesLastChangedDay`. */
    private recoveriesLastChangedDay: number = 0;
    /** Java `daysOfMembersRemaining` / membersCreditDays. */
    private daysOfMembersRemaining: number = 0;
    /** Derived for clientCode 660 display (kept for any 289-era call sites). */
    private daysSinceLastLogin: number = 0;
    private daysSinceRecoveriesChanged: number = 0;
    private unreadMessages: number = 0;
    private warnMembersInNonMembers: number = 0;

    private onDemand: OnDemand | null = null;
    public db: Database | null = null;
    private jagChecksum: number[] = [];

    private npc: (ClientNpc | null)[] = new TypedArray1d(16384, null);
    private npcCount: number = 0;
    private npcIds: Int32Array = new Int32Array(16384);

    private stream: ClientStream | null = null;
    private loginSeed: bigint = 0n;
    private randomIn: Isaac | null = null;
    private out: Packet = Packet.alloc(1);
    private loginout: Packet = Packet.alloc(1);
    private in: Packet = Packet.alloc(1);
    private psize: number = 0;
    private ptype: number = 0;
    private timeoutTimer: number = 0;
    private noTimeoutTimer: number = 0;
    private logoutTimer: number = 0;
    private ptype0: number = 0;
    private ptype1: number = 0;
    private ptype2: number = 0;

    private title: JagFile | null = null;
    private p11: PixFont | null = null;
    private p12: PixFont | null = null;
    private b12: PixFont | null = null;
    private q8: PixFont | null = null;

    private mapBuildBaseX: number = 0;
    private mapBuildBaseZ: number = 0;
    private mapBuildPrevBaseX: number = 0;
    private mapBuildPrevBaseZ: number = 0;
    private sceneState: number = 0;
    private sceneLoadStartTime: number = 0;
    private withinTutorialIsland: boolean = false;
    private awaitingPlayerInfo: boolean = false;
    private mapBuildCentreZoneX: number = 0;
    private mapBuildCentreZoneZ: number = 0;
    private mapBuildIndex: Int32Array | null = null;
    private mapBuildGroundFile: number[] = [];
    private mapBuildLocationFile: number[] = [];
    private mapBuildGroundData: (Uint8Array | null)[] | null = null;
    private mapBuildLocationData: (Uint8Array | null)[] | null = null;
    /** Java `sceneInstanced` — true after REBUILD_REGION (ptype 53). */
    private sceneInstanced: boolean = false;
    /** Java `sceneMapRegion[4][13][13]` — packed 8×8 chunk keys for instanced maps (-1 empty). */
    private sceneMapRegion: number[][][] = allocSceneMapRegion();
    private world: World | null = null;
    private mapl: Uint8Array[][] | null = null;
    private groundh: Int32Array[][] | null = null;
    private collision: (CollisionMap | null)[] = new TypedArray1d(BuildArea.LEVELS, null);
    private textureBuffer: Int8Array = new Int8Array(16384);
    /** Java `Client.ANIMATED_TEXTURES` — water/lava/etc. scroll in `updateTextures`. */
    private readonly animatedTextures: Int32Array = new Int32Array([17, 24, 34, 40]);

    private zoneUpdateX: number = 0;
    private zoneUpdateZ: number = 0;

    private tryMoveNearest: number = 0;
    private dirMap: Int32Array = new Int32Array(BuildArea.SIZE * BuildArea.SIZE);
    private distMap: Int32Array = new Int32Array(BuildArea.SIZE * BuildArea.SIZE);
    private routeX: Int32Array = new Int32Array(4000);
    private routeZ: Int32Array = new Int32Array(4000);

    private macroCameraX: number = 0;
    private macroCameraXModifier: number = 2;
    private macroCameraZ: number = 0;
    private macroCameraZModifier: number = 2;
    private macroCameraAngle: number = 0;
    private macroCameraAngleModifier: number = 1;
    private macroCameraCycle: number = 0;
    private macroMinimapAngle: number = 0;
    private macroMinimapAngleModifier: number = 2;
    private macroMinimapZoom: number = 0;
    private macroMinimapZoomModifier: number = 1;
    private macroMinimapCycle: number = 0;

    private worldUpdateNum: number = 0;

    private minimap: Pix32 | null = null;
    private compass: Pix32 | null = null;
    private mapedge: Pix32 | null = null;
    private mapscene: (Pix8 | null)[] = new TypedArray1d(50, null);
    private mapfunction: (Pix32 | null)[] = new TypedArray1d(50, null);
    private hitmarks: (Pix32 | null)[] = new TypedArray1d(20, null);
    /** 377 Java imageHeadiconsPk / imageHeadiconsPrayer / imageHeadiconsHint */
    private headiconsPk: (Pix32 | null)[] = new TypedArray1d(6, null);
    private headiconsPrayer: (Pix32 | null)[] = new TypedArray1d(9, null);
    private headiconsHint: (Pix32 | null)[] = new TypedArray1d(6, null);
    private overlayMultiway: Pix32 | null = null;
    private mapmarker1: Pix32 | null = null;
    private mapmarker2: Pix32 | null = null;
    private cross: (Pix32 | null)[] = new TypedArray1d(8, null);
    /** Java imageMapdot0..4 = mapdots 0..4 */
    private mapdots1: Pix32 | null = null; // ground objs
    private mapdots2: Pix32 | null = null; // npcs
    private mapdots3: Pix32 | null = null; // players
    private mapdots4: Pix32 | null = null; // friends
    private mapdots5: Pix32 | null = null; // team (Java imageMapdot4)
    private scrollbar1: Pix8 | null = null;
    private scrollbar2: Pix8 | null = null;
    private modIcons: Pix8[] = [];

    private redrawFrame: boolean = true;

    private imageTitle2: PixMap | null = null;
    private imageTitle3: PixMap | null = null;
    private imageTitle4: PixMap | null = null;
    private imageTitle0: PixMap | null = null;
    private imageTitle1: PixMap | null = null;
    private imageTitle5: PixMap | null = null;
    private imageTitle6: PixMap | null = null;
    private imageTitle7: PixMap | null = null;
    private imageTitle8: PixMap | null = null;
    private imageTitlebox: Pix8 | null = null;
    private imageTitlebutton: Pix8 | null = null;
    private loginscreen: number = 0;
    private loginSelect: number = 0;
    private loginMes1: string = '';
    private loginMes2: string = '';
    private loginUser: string = '';
    private loginPass: string = '';
    /** Java `loginRetryCount` — silent reconnects on response -1 before giving up. */
    private loginRetryCount: number = 0;

    private imageRunes: Pix8[] = [];
    private titleFlames: TitleFlames | null = null;

    private areaSide: PixMap | null = null;
    private areaMap: PixMap | null = null;
    private areaGame: PixMap | null = null;
    private areaChat: PixMap | null = null;
    private areaBackbase1: PixMap | null = null;
    private areaBackbase2: PixMap | null = null;
    private areaBackhmid1: PixMap | null = null;
    private areaBackleft1: PixMap | null = null;
    private areaBackleft2: PixMap | null = null;
    private areaBackright1: PixMap | null = null;
    private areaBackright2: PixMap | null = null;
    private areaBacktop1: PixMap | null = null;
    private areaBackvmid1: PixMap | null = null;
    private areaBackvmid2: PixMap | null = null;
    private areaBackvmid3: PixMap | null = null;
    private areaBackhmid2: PixMap | null = null;
    private chatScanline: Int32Array | null = null;
    private sideScanline: Int32Array | null = null;
    private gameScanline: Int32Array | null = null;
    /** Java `Pix3D.centerX/Y` after `init3D(334, 512)` — restored with gameScanline on viewport bind. */
    private gameOriginX: number = 256;
    private gameOriginY: number = 167;
    private invback: Pix8 | null = null;
    private chatback: Pix8 | null = null;
    private backbase1: Pix8 | null = null;
    private backbase2: Pix8 | null = null;
    private backhmid1: Pix8 | null = null;
    private sideicons: (Pix8 | null)[] = new TypedArray1d(13, null);
    private redstone1: Pix8 | null = null;
    private redstone2: Pix8 | null = null;
    private redstone3: Pix8 | null = null;
    private redstone1h: Pix8 | null = null;
    private redstone2h: Pix8 | null = null;
    private redstone1v: Pix8 | null = null;
    private redstone2v: Pix8 | null = null;
    private redstone3v: Pix8 | null = null;
    private redstone1hv: Pix8 | null = null;
    private redstone2hv: Pix8 | null = null;
    private redrawSide: boolean = false;
    private redrawChat: boolean = false;
    private redrawIcons: boolean = false;
    private redrawChatMode: boolean = false;

    private mapback: Pix8 | null = null;
    private compassMaskLineOffsets: Int32Array = new Int32Array(33);
    private compassMaskLineLengths: Int32Array = new Int32Array(33);
    private minimapMaskLineOffsets: Int32Array = new Int32Array(151);
    private minimapMaskLineLengths: Int32Array = new Int32Array(151);

    private scrollGrabbed: boolean = false;
    private scrollInputPadding: number = 0;
    private scrollCycle: number = 0;

    private camX: number = 0;
    private camY: number = 0;
    private camZ: number = 0;
    private camPitch: number = 0;
    private camYaw: number = 0;
    private orbitCameraPitch: number = 128;
    private orbitCameraYaw: number = 0;
    private orbitCameraYawVelocity: number = 0;
    private orbitCameraPitchVelocity: number = 0;
    private orbitCameraX: number = 0;
    private orbitCameraZ: number = 0;
    private sendCameraDelay: number = 0;
    private sendCamera: boolean = false;
    private cameraPitchClamp: number = 0;

    private chatCount: number = 0;
    private chatX: Int32Array = new Int32Array(MAX_CHATS);
    private chatY: Int32Array = new Int32Array(MAX_CHATS);
    private chatHeight: Int32Array = new Int32Array(MAX_CHATS);
    private chatWidth: Int32Array = new Int32Array(MAX_CHATS);
    private chatColour: Int32Array = new Int32Array(MAX_CHATS);
    private chatEffect: Int32Array = new Int32Array(MAX_CHATS);
    private chatTimer: Int32Array = new Int32Array(MAX_CHATS);
    private chats: (string | null)[] = new TypedArray1d(MAX_CHATS, null);

    private tileLastOccupiedCycle: Int32Array[] = new Int32Array2d(BuildArea.SIZE, BuildArea.SIZE);
    private sceneCycle: number = 0;

    private projectX: number = 0;
    private projectY: number = 0;

    private crossX: number = 0;
    private crossY: number = 0;
    private crossCycle: number = 0;
    private crossMode: number = 0;

    private selectedArea: number = 0;
    private selectedComId: number = 0;
    private selectedItem: number = 0;
    private selectedCycle: number = 0;

    private objDragArea: number = 0;
    private objDragComId: number = 0;
    private hoveredSlotComId: number = 0;
    private objDragSlot: number = 0;
    private objGrabX: number = 0;
    private objGrabY: number = 0;
    private hoveredSlot: number = 0;
    private objGrabThreshold: boolean = false;
    private objDragCycles: number = 0;

    private inMultizone: number = 0;
    private chatDisabled: number = 0;

    private players: (ClientPlayer | null)[] = new TypedArray1d(MAX_PLAYER_COUNT, null);
    private playerCount: number = 0;
    private playerIds: Int32Array = new Int32Array(MAX_PLAYER_COUNT);

    private entityUpdateCount: number = 0;
    private entityUpdateIds: Int32Array = new Int32Array(MAX_PLAYER_COUNT);
    private playerAppearanceBuffer: (Packet | null)[] = new TypedArray1d(MAX_PLAYER_COUNT, null);

    private minusedlevel: number = 0;
    private selfSlot: number = -1;
    private localPlayer: ClientPlayer | null = null;
    private membersAccount: number = 0;

    private entityRemovalCount: number = 0;
    private entityRemovalIds: Int32Array = new Int32Array(1000);

    private playerOp: (string | null)[] = new TypedArray1d(5, null);
    private playerOpPriority: boolean[] = new TypedArray1d(5, false);

    private groundObj: (LinkList<ClientObj> | null)[][][] = new TypedArray3d(BuildArea.LEVELS, BuildArea.SIZE, BuildArea.SIZE, null);
    private locChanges: LinkList<LocChange> = new LinkList();
    private projectiles: LinkList<ClientProj> = new LinkList();
    private spotanims: LinkList<MapSpotAnim> = new LinkList();

    private statEffectiveLevel: Int32Array = new Int32Array(Skill.count);
    private statBaseLevel: Int32Array = new Int32Array(Skill.count);
    private statXP: Int32Array = new Int32Array(Skill.count);

    private oneMouseButton: number = 0;
    private isMenuOpen: boolean = false;
    private menuNumEntries: number = 0;
    private menuArea: number = 0;
    private menuX: number = 0;
    private menuY: number = 0;
    private menuWidth: number = 0;
    private menuHeight: number = 0;
    private menuParamB: Int32Array = new Int32Array(500);
    private menuParamC: Int32Array = new Int32Array(500);
    private menuAction: Int32Array = new Int32Array(500);
    private menuParamA: Int32Array = new Int32Array(500);
    private menuOption: string[] = [];

    private useMode: number = 0;
    private objComId: number = 0;
    private objSelectedName: string | null = null;
    private objSelectedComId: number = 0;
    private objSelectedSlot: number = 0;

    private targetMode: number = 0;
    private targetComId: number = 0;
    private targetMask: number = 0;
    private targetOp: string | null = null;

    private chatModalId: number = -1;
    private mainModalId: number = -1;
    private sideModalId: number = -1;
    private mainOverlayId: number = -1;
    /** Java `fullscreenInterfaceId0` — primary 765×503 layer (IF_OPENFULL main). */
    private fullscreenInterfaceId0: number = -1;
    /** Java `fullscreenInterfaceId1` — secondary overlay on fullscreen (IF_OPENFULL overlay). */
    private fullscreenInterfaceId1: number = -1;
    /** Java `areaFullscreenOffset` — Pix3D scanline for 765×503. */
    private fullscreenScanline: Int32Array | null = null;
    private lastOverComId: number = 0;
    private overChatComId: number = 0;
    private overMainComId: number = 0;
    private overSideComId: number = 0;
    /**
     * Type-8 tooltip hover (Java field611 / field425 / field340 / field580 / field189).
     * Tooltip draws only when timer reaches 100.
     */
    private tooltipHoverComId: number = 0;
    private overTooltipMain: number = 0;
    private overTooltipSide: number = 0;
    private overTooltipChat: number = 0;
    private tooltipTimer: number = 0;
    private activeIcon: number = 3;
    private sideIcon: number[] = [
        -1, -1, -1,
        -1, -1, -1,
        -1, -1, -1,
        -1, -1, -1,
        -1, -1, -1
    ];
    private tutComId: number = -1;
    private tutComMessage: string | null = null;
    private tutFlashIcon: number = -1;

    private chatEffects: number = 0;
    private splitPrivateChat: number = 0;
    private bankArrangeMode: number = 0;

    private resumedPauseButton: boolean = false;
    private runenergy: number = 0;
    private runweight: number = 0;
    private staffmodlevel: number = 0;
    /**
     * Java `Client.varps` — public so LocType.varProvider / ClientLocAnim.varProvider can read
     * multiloc / multinpc state (method562 / method440).
     */
    var: number[] = [];
    private varServ: number[] = [];

    private chatInterface: IfType = new IfType();
    private chatScrollHeight: number = 78;
    private chatScrollPos: number = 0;
    private chatInput: string = '';
    private chatType: Int32Array = new Int32Array(100);
    private chatUsername: (string | null)[] = new TypedArray1d(100, null);
    private chatText: (string | null)[] = new TypedArray1d(100, null);
    private chatPublicMode: number = 0;
    private chatPrivateMode: number = 0;
    private chatTradeMode: number = 0;
    private privateMessageIds: Int32Array = new Int32Array(100);
    private privateMessageCount: number = 0;

    private socialUserhash: bigint | null = null;
    private socialInputOpen: boolean = false;
    private socialInput: string = '';
    private socialInputType: number = 0;
    private socialInputHeader: string = '';

    /**
     * Java `chatbackInputOpen`: 0=closed, 1=amount, 2=name, 3=obj search.
     * `dialogInputOpen` kept as boolean alias for amount mode (mobile / existing call sites).
     * Obj-search fields map Java field158/field159/field161 (rarely opened on 377 wire).
     */
    private chatbackInputOpen: number = 0;
    private dialogInputOpen: boolean = false;
    private dialogInput: string = '';
    private objSearchResultCount: number = 0;
    private objSearchResults: (string | null)[] = new TypedArray1d(100, null);
    private objSearchScrollPos: number = 0;
    private objSearchLastQuery: string = '';

    private reportAbuseInput: string = '';
    private reportAbuseMuteOption: boolean = false;
    private reportAbuseComId: number = -1;

    private minimapState: number = 0;
    private minimapLevel: number = -1;
    private activeMapFunctionCount: number = 0;
    private activeMapFunctionX: Int32Array = new Int32Array(1000);
    private activeMapFunctionZ: Int32Array = new Int32Array(1000);
    private activeMapFunctions: (Pix32 | null)[] = new TypedArray1d(1000, null);
    private minimapFlagX: number = 0;
    private minimapFlagZ: number = 0;

    private midiActive: boolean = true;
    /** Java signlink.midivol 0..128 (default 96). Not dB — Decision 012. */
    private midiVolume: number = 96;
    private midiSong: number = -1;
    private nextMidiSong: number = -1;
    private nextMusicDelay: number = 0;
    private midiFading: boolean = true;

    private waveEnabled: boolean = true;
    private waveVolume: number = 0;
    private waveCount: number = 0;
    private waveIds: Int32Array = new Int32Array(50);
    private waveLoops: Int32Array = new Int32Array(50);
    private waveDelay: Int32Array = new Int32Array(50);
    private lastWaveId: number = -1;
    private lastWaveLoops: number = -1;
    private lastWaveLength: number = 0;
    private lastWaveStartTime: number = 0;

    private cinemaCam: boolean = false;
    private camShake: boolean[] = new TypedArray1d(5, false);
    private camShakeAxis: Int32Array = new Int32Array(5);
    private camShakeRan: Int32Array = new Int32Array(5);
    private camShakeAmp: Int32Array = new Int32Array(5);
    private camShakeCycle: Int32Array = new Int32Array(5);
    private camMoveToLx: number = 0;
    private camMoveToLz: number = 0;
    private camMoveToHei: number = 0;
    private camMoveToRate: number = 0;
    private camMoveToRate2: number = 0;
    private camLookAtLx: number = 0;
    private camLookAtLz: number = 0;
    private camLookAtHei: number = 0;
    private camLookAtRate: number = 0;
    private camLookAtRate2: number = 0;

    private friendCount: number = 0;
    private friendServerStatus: number = 0;
    private friendUsername: (string | null)[] = new TypedArray1d(200, null);
    private friendUserhash: BigInt64Array = new BigInt64Array(200);
    private friendNodeId: Int32Array = new Int32Array(200);

    private ignoreCount: number = 0;
    private ignoreUserhash: bigint[] = [];

    private idkDesignGender: boolean = true;
    private idkDesignRedraw: boolean = false;
    private idkDesignPart: Int32Array = new Int32Array(7);
    private idkDesignColour: Int32Array = new Int32Array(5);
    private idkDesignButton1: Pix32 | null = null;
    private idkDesignButton2: Pix32 | null = null;
    private readonly searchParams: URLSearchParams;

    // ----

    constructor(nodeid: number, lowmem: boolean, members: boolean) {
        super();
        this.searchParams = new URLSearchParams(window.location.search);

        if (typeof nodeid === 'undefined' || typeof lowmem === 'undefined' || typeof members === 'undefined') {
            return;
        }

        console.log(`RS2 user client - release #${CLIENT_VERSION}`);

        Client.nodeId = nodeid;
        Client.memServer = members;

        if (lowmem) {
            Client.setLowMem();
        } else {
            Client.setHighMem();
        }

        this.run();
    }

    static setLowMem(): void {
        World.lowMem = true;
        Pix3D.lowMem = true;
        Client.lowMem = true;
        ClientBuild.lowMem = true;
        // Java 377 Client.java:1519 (setLowMem) / :1528 (setHighMem) also set LocType.lowMem,
        // which gates the keep-first model-list rule in LocType decode opcodes 1/5.
        LocType.lowMem = true;
    }

    static setHighMem(): void {
        World.lowMem = false;
        Pix3D.lowMem = false;
        Client.lowMem = false;
        ClientBuild.lowMem = false;
        LocType.lowMem = false;
    }

    /**
     * Java `saveMidi(fade, data)` → midifade + midisave → signlink play.
     * Volume is signlink.midivol (set via options clientcode 3), not per-call dB.
     */
    saveMidi(data: Uint8Array, fading: boolean) {
        if (!this.midiActive) {
            return;
        }
        playMidi(data, this.midiVolume, fading);
    }

    /** Java `stopMidi` — midifade=0, midi="stop". */
    private stopMidiJava(): void {
        stopMidi(false);
    }

    /**
     * Java `setMidiVolume(midiActive, midivol)` — always writes midivol;
     * voladjust only when music was already active.
     */
    private setMidiVolumeJava(active: boolean, midivol: number): void {
        this.midiVolume = midivol;
        setMidiVolume(midivol, active);
    }

    private getIntParam(name: string, fallback: number = 0): number {
        const value: string | null = this.searchParams.get(name);
        if (value === null || !/^[+-]?\d+$/.test(value)) {
            return fallback;
        }

        const parsed: number = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : fallback;
    }

    private drawError(): void {
        canvas2d.fillStyle = 'black';
        canvas2d.fillRect(0, 0, this.sWid, this.sHei);

        this.setFramerate(1);

        this.titleFlames?.close();
        let y: number = 0;

        if (this.errorLoading) {
            canvas2d.font = 'bold 16px helvetica, sans-serif';
            canvas2d.textAlign = 'left';
            canvas2d.fillStyle = 'yellow';
            y = 35;
            canvas2d.fillText('Sorry, an error has occured whilst loading RuneScape', 30, y);

            y += 50;
            canvas2d.fillStyle = 'white';
            canvas2d.fillText('To fix this try the following (in order):', 30, y);

            y += 50;
            canvas2d.font = 'bold 12px helvetica, sans-serif';
            canvas2d.fillText('1: Try closing ALL open web-browser windows, and reloading', 30, y);

            y += 30;
            canvas2d.fillText('2: Try clearing your web-browsers cache', 30, y); // "2: Try clearing your web-browsers cache from tools->internet options"

            y += 30;
            canvas2d.fillText('3: Try using a different game-world', 30, y);

            y += 30;
            canvas2d.fillText('4: Try rebooting your computer', 30, y);

            y += 30;
            canvas2d.fillText('5: Try selecting a different method from the play-game menu', 30, y); // "5: Try selecting a different version of Java from the play-game menu"
        } else if (this.errorHost) {
            canvas2d.font = 'bold 20px helvetica, sans-serif';
            canvas2d.textAlign = 'left';
            canvas2d.fillStyle = 'white';

            y = 50;
            canvas2d.fillText('Error - unable to load game!', 50, y);

            y += 50;
            canvas2d.fillText('To play RuneScape make sure you play from', 50, y);

            y += 50;
            canvas2d.fillText('An approved domain', 50, y); // "http://www.runescape.com"
        } else if (this.errorStarted) {
            canvas2d.font = 'bold 13px helvetica, sans-serif';
            canvas2d.textAlign = 'left';
            canvas2d.fillStyle = 'yellow';

            y = 35;
            canvas2d.fillText('Error a copy of RuneScape already appears to be loaded', 30, y);

            y += 50;
            canvas2d.fillStyle = 'white';
            canvas2d.fillText('To fix this try the following (in order):', 30, y);

            y += 50;
            canvas2d.font = 'bold 12px helvetica, sans-serif';
            canvas2d.fillText('1: Try closing ALL open web-browser windows, and reloading', 30, y);

            y += 30;
            canvas2d.fillText('2: Try rebooting your computer, and reloading', 30, y);
        }

        if (this.errorMessage) {
            y += 50;
            canvas2d.fillStyle = 'red';
            canvas2d.fillText(this.errorMessage, 30, y);
        }
    }

    private async getJagCrc() {
        let wait = 5;
        let retries = 0;

        this.jagChecksum[8] = 0;

        while (this.jagChecksum[8] === 0) {
            let error = 'Unknown problem';
            await this.drawProgress('Connecting to web server', 10);

            try {
                const checksums: Packet = new Packet(await downloadUrl('/crc'));
                for (let i: number = 0; i < 9; i++) {
                    this.jagChecksum[i] = checksums.g4();
                }

                const expected = checksums.g4();
                let calculated = 1234;
                for (let i = 0; i < 9; i++) {
                    calculated = ((calculated << 1) + this.jagChecksum[i]) | 0;
                }

                if (expected !== calculated) {
                    error = 'checksum problem';
                    this.jagChecksum[8] = 0;
                }
            } catch (err) {
                error = 'connection problem';
                this.jagChecksum[8] = 0;
            }

            if (this.jagChecksum[8] === 0) {
                retries++;

                for (let remaining = wait; remaining > 0; remaining--) {
                    if (retries >= 10) {
                        await this.drawProgress('Game updated - please reload page', 10);
                        remaining = 10;
                    } else {
                        await this.drawProgress(`${error} - Will retry in ${remaining} secs.`, 10);
                    }

                    await sleep(1000);
                }

                wait *= 2;
                if (wait > 60) {
                    wait = 60;
                }

                // the java client toggles a "JAGGRAB" HTTP fallback here
            }
        }
    }

    private async getJagFile(displayName: string, progress: number, filename: string, index: number): Promise<JagFile> {
        const crc = this.jagChecksum[index];

        let data: Uint8Array | undefined;
        let retry: number = 5;

        try {
            if (this.db) {
                data = await this.db.read(0, index);
            }
        } catch (_e) {
            // empty
        }

        if (data && Packet.getcrc(data, 0, data.length) !== crc) {
            data = undefined;
        }

        if (data) {
            return new JagFile(data);
        }

        let loops = 0;
        while (!data) {
            await this.drawProgress(`Requesting ${displayName}`, progress);

            try {
                data = await downloadUrl(`/${filename}${crc}`);

                const checksum = Packet.getcrc(data, 0, data.length);
                if (crc === checksum) {
                    try {
                        if (this.db) {
                            await this.db.write(0, index, data);
                        }
                    } catch (_e) {
                        // empty
                    }
                } else {
                    data = undefined;
                    loops++;
                }
            } catch (_e) {
                data = undefined;
            }

            if (!data) {
                for (let i: number = retry; i > 0; i--) {
                    if (loops >= 3) {
                        await this.drawProgress('Game updated - please reload page', progress);
                        i = 10;
                    } else {
                        await this.drawProgress(`Error loading - Will retry in ${i} secs.`, progress);
                    }

                    await sleep(1000);
                }

                retry *= 2;
                if (retry > 60) {
                    retry = 60;
                }
            }
        }

        return new JagFile(data);
    }

    // ----

    override async load() {
        if (this.isMobile && Client.lowMem) {
            // force mobile on low detail mode to 30 fps
            this.setTargetedFramerate(30);
        }

        if (this.alreadyStarted) {
            this.errorStarted = true;
            return;
        }

        this.alreadyStarted = true;

        if (typeof process.env.SECURE_ORIGIN !== 'undefined' && process.env.SECURE_ORIGIN !== 'false' && window.location.hostname !== process.env.SECURE_ORIGIN) {
            this.errorHost = true;
        }

        try {
            this.db = new Database(await Database.openDatabase());
        } catch (_e) {
            // possibly incognito mode
            this.db = null;
        }

        try {
            await this.getJagCrc();

            this.title = await this.getJagFile('title screen', 25, 'title', 1);
            this.p11 = PixFont.depack(this.title, 'p11_full', false);
            this.p12 = PixFont.depack(this.title, 'p12_full', false);
            this.b12 = PixFont.depack(this.title, 'b12_full', false);
            this.q8 = PixFont.depack(this.title, 'q8_full', true);

            await this.loadTitleBackground();
            this.loadTitleImages();

            const config: JagFile = await this.getJagFile('config', 30, 'config', 2);
            const interfaces: JagFile = await this.getJagFile('interface', 35, 'interface', 3);
            const media: JagFile = await this.getJagFile('2d graphics', 40, 'media', 4);
            const textures: JagFile = await this.getJagFile('textures', 45, 'textures', 6);
            const wordenc: JagFile = await this.getJagFile('chat system', 50, 'wordenc', 7);
            const sounds: JagFile = await this.getJagFile('sound effects', 55, 'sounds', 8);

            this.mapl = new Uint8Array3d(BuildArea.LEVELS, BuildArea.SIZE, BuildArea.SIZE);
            this.groundh = new Int32Array3d(BuildArea.LEVELS, BuildArea.SIZE + 1, BuildArea.SIZE + 1);
            this.world = new World(this.groundh, BuildArea.SIZE, BuildArea.LEVELS, BuildArea.SIZE);
            for (let level: number = 0; level < BuildArea.LEVELS; level++) {
                this.collision[level] = new CollisionMap();
            }
            this.minimap = new Pix32(512, 512);

            const versionlist: JagFile = await this.getJagFile('update list', 60, 'versionlist', 5);

            await this.drawProgress('Connecting to update server', 60);

            this.onDemand = new OnDemand(versionlist, this);
            AnimFrame.init(this.onDemand.getAnimFrameCount());
            Model.init(this.onDemand.getFileCount(0), this.onDemand);

            if (!Client.lowMem) {
                this.midiSong = 0; // scape_main
                this.midiSong = this.getIntParam('music', this.midiSong);
                this.midiFading = true;
                this.onDemand.request(2, this.midiSong);

                while (this.onDemand.remaining() > 0) {
                    await this.updateOnDemand();
                    await sleep(100);
                }
            }

            await this.drawProgress('Requesting animations', 65);

            const animCount = this.onDemand.getFileCount(1);
            for (let i = 0; i < animCount; i++) {
                this.onDemand.request(1, i);
            }

            while (this.onDemand.remaining() > 0) {
                const progress = animCount - this.onDemand.remaining();
                if (progress > 0) {
                    await this.drawProgress('Loading animations - ' + (((progress * 100) / animCount) | 0) + '%', 65);
                }

                await this.updateOnDemand();
                await sleep(100);
            }

            await this.drawProgress('Requesting models', 70);

            const modelCount = this.onDemand.getFileCount(0);
            for (let i = 0; i < modelCount; i++) {
                const flags = this.onDemand.getModelUse(i);
                if ((flags & 0x1) != 0) {
                    this.onDemand.request(0, i);
                }
            }

            const modelPrefetch = this.onDemand.remaining();
            while (this.onDemand.remaining() > 0) {
                const progress = modelPrefetch - this.onDemand.remaining();
                if (progress > 0) {
                    await this.drawProgress('Loading models - ' + (((progress * 100) / modelPrefetch) | 0) + '%', 70);
                }

                await this.updateOnDemand();
                await sleep(100);
            }

            if (this.db) {
                await this.drawProgress('Requesting maps', 75);

                this.onDemand.request(3, this.onDemand.getMapFile(48, 47, 0));
                this.onDemand.request(3, this.onDemand.getMapFile(48, 47, 1));

                this.onDemand.request(3, this.onDemand.getMapFile(48, 48, 0));
                this.onDemand.request(3, this.onDemand.getMapFile(48, 48, 1));

                this.onDemand.request(3, this.onDemand.getMapFile(48, 49, 0));
                this.onDemand.request(3, this.onDemand.getMapFile(48, 49, 1));

                this.onDemand.request(3, this.onDemand.getMapFile(47, 47, 0));
                this.onDemand.request(3, this.onDemand.getMapFile(47, 47, 1));

                this.onDemand.request(3, this.onDemand.getMapFile(47, 48, 0));
                this.onDemand.request(3, this.onDemand.getMapFile(47, 48, 1));

                this.onDemand.request(3, this.onDemand.getMapFile(48, 148, 0));
                this.onDemand.request(3, this.onDemand.getMapFile(48, 148, 1));

                const mapPrefetch = this.onDemand.remaining();
                while (this.onDemand.remaining() > 0) {
                    const progress = mapPrefetch - this.onDemand.remaining();
                    if (progress > 0) {
                        await this.drawProgress('Loading maps - ' + (((progress * 100) / mapPrefetch) | 0) + '%', 75);
                    }

                    await this.updateOnDemand();
                    await sleep(100);
                }
            }

            const modelCount2 = this.onDemand.getFileCount(0);
            for (let i = 0; i < modelCount2; i++) {
                const flags = this.onDemand.getModelUse(i);

                let priority = 0;
                if ((flags & 0x8) != 0) {
                    priority = 10;
                } else if ((flags & 0x20) != 0) {
                    priority = 9;
                } else if ((flags & 0x10) != 0) {
                    priority = 8;
                } else if ((flags & 0x40) != 0) {
                    priority = 7;
                } else if ((flags & 0x80) != 0) {
                    priority = 6;
                } else if ((flags & 0x2) != 0) {
                    priority = 5;
                } else if ((flags & 0x4) != 0) {
                    priority = 4;
                }

                if ((flags & 0x1) != 0) {
                    priority = 3;
                }

                if (priority != 0) {
                    await this.onDemand.prefetchPriority(0, i, priority);
                }
            }

            await this.onDemand.prefetchMaps(Client.memServer);

            if (!Client.lowMem) {
                const midiCount = this.onDemand.getFileCount(2);
                for (let i = 1; i < midiCount; i++) {
                    if (this.onDemand.isMidiJingle(i)) {
                        await this.onDemand.prefetchPriority(2, i, 1);
                    }
                }
            }

            await this.drawProgress('Unpacking media', 80);

            this.invback = Pix8.depack(media, 'invback', 0);
            this.chatback = Pix8.depack(media, 'chatback', 0);
            this.mapback = Pix8.depack(media, 'mapback', 0);

            this.backbase1 = Pix8.depack(media, 'backbase1', 0);
            this.backbase2 = Pix8.depack(media, 'backbase2', 0);
            this.backhmid1 = Pix8.depack(media, 'backhmid1', 0);

            for (let i: number = 0; i < 13; i++) {
                this.sideicons[i] = Pix8.depack(media, 'sideicons', i);
            }

            this.compass = Pix32.depack(media, 'compass', 0);

            this.mapedge = Pix32.depack(media, 'mapedge', 0);
            this.mapedge.trim();

            try {
                for (let i: number = 0; i < 50; i++) {
                    this.mapscene[i] = Pix8.depack(media, 'mapscene', i);
                }
            } catch (_e) {
                // empty
            }

            try {
                for (let i: number = 0; i < 50; i++) {
                    this.mapfunction[i] = Pix32.depack(media, 'mapfunction', i);
                }
            } catch (_e) {
                // empty
            }

            try {
                for (let i: number = 0; i < 20; i++) {
                    this.hitmarks[i] = Pix32.depack(media, 'hitmarks', i);
                }
            } catch (_e) {
                // empty
            }

            try {
                for (let i: number = 0; i < 6; i++) {
                    this.headiconsPk[i] = Pix32.depack(media, 'headicons_pk', i);
                }
            } catch (_e) {
                // empty
            }

            try {
                for (let i: number = 0; i < 9; i++) {
                    this.headiconsPrayer[i] = Pix32.depack(media, 'headicons_prayer', i);
                }
            } catch (_e) {
                // empty
            }

            try {
                for (let i: number = 0; i < 6; i++) {
                    this.headiconsHint[i] = Pix32.depack(media, 'headicons_hint', i);
                }
            } catch (_e) {
                // empty
            }

            try {
                this.overlayMultiway = Pix32.depack(media, 'overlay_multiway', 0);
            } catch (_e) {
                // empty
            }

            this.mapmarker1 = Pix32.depack(media, 'mapmarker', 0);
            this.mapmarker2 = Pix32.depack(media, 'mapmarker', 1);

            for (let i: number = 0; i < 8; i++) {
                this.cross[i] = Pix32.depack(media, 'cross', i);
            }

            this.mapdots1 = Pix32.depack(media, 'mapdots', 0);
            this.mapdots2 = Pix32.depack(media, 'mapdots', 1);
            this.mapdots3 = Pix32.depack(media, 'mapdots', 2);
            this.mapdots4 = Pix32.depack(media, 'mapdots', 3);
            this.mapdots5 = Pix32.depack(media, 'mapdots', 4);

            this.scrollbar1 = Pix8.depack(media, 'scrollbar', 0);
            this.scrollbar2 = Pix8.depack(media, 'scrollbar', 1);

            this.redstone1 = Pix8.depack(media, 'redstone1', 0);
            this.redstone2 = Pix8.depack(media, 'redstone2', 0);
            this.redstone3 = Pix8.depack(media, 'redstone3', 0);

            this.redstone1h = Pix8.depack(media, 'redstone1', 0);
            this.redstone1h?.hflip();

            this.redstone2h = Pix8.depack(media, 'redstone2', 0);
            this.redstone2h?.hflip();

            this.redstone1v = Pix8.depack(media, 'redstone1', 0);
            this.redstone1v?.vflip();

            this.redstone2v = Pix8.depack(media, 'redstone2', 0);
            this.redstone2v?.vflip();

            this.redstone3v = Pix8.depack(media, 'redstone3', 0);
            this.redstone3v?.vflip();

            this.redstone1hv = Pix8.depack(media, 'redstone1', 0);
            this.redstone1hv?.hflip();
            this.redstone1hv?.vflip();

            this.redstone2hv = Pix8.depack(media, 'redstone2', 0);
            this.redstone2hv?.hflip();
            this.redstone2hv?.vflip();

            for (let i = 0; i < 2; i++) {
                this.modIcons[i] = Pix8.depack(media, 'mod_icons', i);
            }

            const backleft1: Pix32 = Pix32.depack(media, 'backleft1', 0);
            this.areaBackleft1 = new PixMap(backleft1.wi, backleft1.hi);
            backleft1.quickPlotSprite(0, 0);

            const backleft2: Pix32 = Pix32.depack(media, 'backleft2', 0);
            this.areaBackleft2 = new PixMap(backleft2.wi, backleft2.hi);
            backleft2.quickPlotSprite(0, 0);

            const backright1: Pix32 = Pix32.depack(media, 'backright1', 0);
            this.areaBackright1 = new PixMap(backright1.wi, backright1.hi);
            backright1.quickPlotSprite(0, 0);

            const backright2: Pix32 = Pix32.depack(media, 'backright2', 0);
            this.areaBackright2 = new PixMap(backright2.wi, backright2.hi);
            backright2.quickPlotSprite(0, 0);

            const backtop1: Pix32 = Pix32.depack(media, 'backtop1', 0);
            this.areaBacktop1 = new PixMap(backtop1.wi, backtop1.hi);
            backtop1.quickPlotSprite(0, 0);

            const backvmid1: Pix32 = Pix32.depack(media, 'backvmid1', 0);
            this.areaBackvmid1 = new PixMap(backvmid1.wi, backvmid1.hi);
            backvmid1.quickPlotSprite(0, 0);

            const backvmid2: Pix32 = Pix32.depack(media, 'backvmid2', 0);
            this.areaBackvmid2 = new PixMap(backvmid2.wi, backvmid2.hi);
            backvmid2.quickPlotSprite(0, 0);

            const backvmid3: Pix32 = Pix32.depack(media, 'backvmid3', 0);
            this.areaBackvmid3 = new PixMap(backvmid3.wi, backvmid3.hi);
            backvmid3.quickPlotSprite(0, 0);

            const backhmid2: Pix32 = Pix32.depack(media, 'backhmid2', 0);
            this.areaBackhmid2 = new PixMap(backhmid2.wi, backhmid2.hi);
            backhmid2.quickPlotSprite(0, 0);

            const randR: number = ((Math.random() * 21.0) | 0) - 10;
            const randG: number = ((Math.random() * 21.0) | 0) - 10;
            const randB: number = ((Math.random() * 21.0) | 0) - 10;
            const rand: number = ((Math.random() * 41.0) | 0) - 20;

            for (let i: number = 0; i < 50; i++) {
                if (this.mapfunction[i]) {
                    this.mapfunction[i]?.rgbAdjust(randR + rand, randG + rand, randB + rand);
                }

                if (this.mapscene[i]) {
                    this.mapscene[i]?.rgbAdjust(randR + rand, randG + rand, randB + rand);
                }
            }

            await this.drawProgress('Unpacking textures', 83);

            Pix3D.unpackTextures(textures);
            Pix3D.initColourTable(0.8);
            Pix3D.initPool(20);

            await this.drawProgress('Unpacking config', 86);

            SeqType.init(config);
            LocType.init(config);
            FloType.init(config);
            ObjType.init(config, Client.memServer);
            NpcType.init(config);
            IdkType.init(config);
            SpotType.init(config);
            VarpType.init(config);
            VarBitType.init(config);

            if (!Client.lowMem) {
                await this.drawProgress('Unpacking sounds', 90);
                const soundsDat = sounds.read('sounds.dat');
                JagFX.init(new Packet(soundsDat));
            }

            await this.drawProgress('Unpacking interfaces', 95);

            IfType.init(interfaces, media, [this.p11, this.p12, this.b12, this.q8]);

            await this.drawProgress('Preparing game engine', 100);

            for (let y: number = 0; y < 33; y++) {
                let left: number = 999;
                let right: number = 0;

                for (let x: number = 0; x < 34; x++) {
                    if (this.mapback.data[x + y * this.mapback.wi] === 0) {
                        if (left === 999) {
                            left = x;
                        }
                    } else if (left !== 999) {
                        right = x;
                        break;
                    }
                }

                this.compassMaskLineOffsets[y] = left;
                this.compassMaskLineLengths[y] = right - left;
            }

            for (let y: number = 5; y < 156; y++) {
                let left: number = 999;
                let right: number = 0;

                for (let x: number = 25; x < 172; x++) {
                    if (this.mapback.data[x + y * this.mapback.wi] === 0 && (x > 34 || y > 34)) {
                        if (left === 999) {
                            left = x;
                        }
                    } else if (left !== 999) {
                        right = x;
                        break;
                    }
                }

                this.minimapMaskLineOffsets[y - 5] = left - 25;
                this.minimapMaskLineLengths[y - 5] = right - left;
            }

            // Java Client.load init3D order (height,width):
            //   init3D(503,765) fullscreen → init3D(96,479) chat → init3D(261,190) side → init3D(334,512) viewport LAST
            // so centerX/Y remain at the game viewport. TS setClipping is (width, height).
            // Was: game then fullscreen LAST → origin stuck at 382/251 → 3D projection wrong / often black.
            Pix3D.setClipping(765, 503);
            this.fullscreenScanline = Pix3D.scanline;

            Pix3D.setClipping(479, 96);
            this.chatScanline = Pix3D.scanline;

            Pix3D.setClipping(190, 261);
            this.sideScanline = Pix3D.scanline;

            Pix3D.setClipping(512, 334);
            this.gameScanline = Pix3D.scanline;
            this.gameOriginX = Pix3D.originX;
            this.gameOriginY = Pix3D.originY;

            const distance: Int32Array = new Int32Array(9);
            for (let x: number = 0; x < 9; x++) {
                const angle: number = x * 32 + 128 + 15;
                const offset: number = angle * 3 + 600;
                const sin: number = Pix3D.sinTable[angle];
                distance[x] = (offset * sin) >> 16;
            }

            World.resetVisCalc(distance, 500, 800, 512, 334);
            WordFilter.unpack(wordenc);

            // Java Client load: ClientLocAnim.varProvider = this; LocType.varProvider = this;
            LocType.varProvider = this;
            LocType.varbitMasks = Client.readbit;
            ClientLocAnim.varProvider = this;
            // Multi-npc (method476) — same provider as locs
            NpcType.varProvider = this;
            NpcType.varbitMasks = Client.readbit;

            if (!this.mouseTrackingInterval) {
                this.mouseTrackingInterval = setInterval(() => {
                    this.mouseTracking.cycle();
                }, 50);
            }
        } catch (e) {
            console.error(e);

            if (e instanceof Error) {
                this.errorMessage = `loaderror - ${this.lastProgressMessage} ${this.lastProgressPercent}%: ${e.message}`;
            }

            this.errorLoading = true;
        }
    }

    override async update() {
        if (this.errorStarted || this.errorLoading || this.errorHost) {
            return;
        }

        Client.loopCycle++;

        if (!this.ingame) {
            await this.updateTitle();
        } else {
            await this.updateGame();
        }

        await this.updateOnDemand();
    }

    override async draw() {
        if (this.errorStarted || this.errorLoading || this.errorHost) {
            this.drawError();
            return;
        }

        Client.drawCycle++;

        if (!this.ingame) {
            await this.drawTitle();
        } else {
            this.drawGame();
        }

        if (this.isMobile) {
            MobileKeyboard.draw();
        }

        this.scrollCycle = 0;
    }

    override refresh() {
        this.redrawFrame = true;
    }

    protected override unload(): void {
        this.stream?.close();
        this.stream = null;

        if (this.mouseTrackingInterval) {
            clearInterval(this.mouseTrackingInterval);
            this.mouseTrackingInterval = null;
        }

        this.onDemand?.stop();
        this.onDemand = null;

        this.unloadTitle();
        this.drawArea = null;
    }

    // ----

    /**
     * Port of Client-Java `updateOnDemand` (377).
     * Must process **null** completions: models install empty Metadata (method357),
     * maps set land/loc file = -1 so checkScene stops waiting. Skipping nulls
     * permanently stuck sceneState=1 (status -1/-2/-3, onDemandRem=0).
     */
    async updateOnDemand() {
        if (!this.onDemand) {
            return;
        }

        await this.onDemand.run();

        while (true) {
            const req = this.onDemand.loop();
            if (req === null) {
                return;
            }

            // Java: separate ifs, not else-if; archive is unique per request.
            if (req.archive === 0) {
                // Java Model.method357(data, file) — null → empty meta so method360 returns true
                Model.unpack(req.file, req.data);

                if ((this.onDemand.getModelUse(req.file) & 0x62) != 0) {
                    this.redrawSide = true;

                    if (this.chatModalId !== -1) {
                        this.redrawChat = true;
                    }
                }
            }
            if (req.archive === 1 && req.data != null) {
                AnimFrame.unpack(req.data);
            }
            if (req.archive === 2 && this.midiSong === req.file && req.data != null) {
                this.saveMidi(req.data, this.midiFading);
            }
            if (req.archive === 3 && this.sceneState === 1) {
                // Java does not guard arrays; TS keeps null-safe check for pre-REBUILD.
                if (this.mapBuildGroundData && this.mapBuildLocationData) {
                    for (let i = 0; i < this.mapBuildGroundData.length; i++) {
                        if (this.mapBuildGroundFile[i] == req.file) {
                            this.mapBuildGroundData[i] = req.data;

                            if (req.data == null) {
                                // checkScene: file==-1 means "not required" — stop waiting forever
                                this.mapBuildGroundFile[i] = -1;
                                console.warn(`[377port] map land file=${req.file} completed with null data → skip`);
                            }

                            break;
                        }

                        if (this.mapBuildLocationFile[i] == req.file) {
                            this.mapBuildLocationData[i] = req.data;

                            if (req.data == null) {
                                this.mapBuildLocationFile[i] = -1;
                                console.warn(`[377port] map loc file=${req.file} completed with null data → skip`);
                            }

                            break;
                        }
                    }
                }
            }
            // Java archive 93: Packet(req.data) without null check (NPE if null). Guard data.
            if (req.archive === 93 && req.data != null && this.onDemand.hasMapLocFile(req.file)) {
                ClientBuild.prefetchLocations(new Packet(req.data), this.onDemand);
            }
        }
    }

    private async updateTitle(): Promise<void> {
        if (this.loginscreen === 0) {
            let x: number = ((this.sWid / 2) | 0) - 80;
            let y: number = ((this.sHei / 2) | 0) + 20;

            y += 20;
            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                this.loginscreen = 3;
                this.loginSelect = 0;
            }

            x = ((this.sWid / 2) | 0) + 80;
            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                this.loginMes1 = '';
                this.loginMes2 = 'Enter your username & password.';
                this.loginscreen = 2;
                this.loginSelect = 0;
            }
        } else if (this.loginscreen === 2) {
            let y: number = ((this.sHei / 2) | 0) - 40;
            y += 30;

            y += 25;
            if (this.mouseClickButton === 1 && this.mouseClickY >= y - 15 && this.mouseClickY < y) {
                this.loginSelect = 0;
            }

            y += 15;
            if (this.mouseClickButton === 1 && this.mouseClickY >= y - 15 && this.mouseClickY < y) {
                this.loginSelect = 1;
            }
            // y += 15; dead code

            let x = ((this.sWid / 2) | 0) - 80;
            y = ((this.sHei / 2) | 0) + 50;
            y += 20;

            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                // Java updateTitle: loginRetryCount = 0 before login
                this.loginRetryCount = 0;
                await this.login(this.loginUser, this.loginPass, false);

                if (this.ingame) {
                    return;
                }
            }

            x = ((this.sWid / 2) | 0) + 80;
            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                this.loginscreen = 0;
                this.loginUser = '';
                this.loginPass = '';
            }

            while (true) {
                const key: number = this.pollKey();
                if (key === -1) {
                    return;
                }

                let valid: boolean = false;
                for (let i: number = 0; i < Client.CHARSET.length; i++) {
                    if (String.fromCharCode(key) === Client.CHARSET.charAt(i)) {
                        valid = true;
                        break;
                    }
                }

                if (this.loginSelect === 0) {
                    if (key === 8 && this.loginUser.length > 0) {
                        this.loginUser = this.loginUser.substring(0, this.loginUser.length - 1);
                    }

                    if (key === 9 || key === 10 || key === 13) {
                        this.loginSelect = 1;
                    }

                    if (valid) {
                        this.loginUser = this.loginUser + String.fromCharCode(key);
                    }

                    if (this.loginUser.length > 12) {
                        this.loginUser = this.loginUser.substring(0, 12);
                    }
                } else if (this.loginSelect === 1) {
                    if (key === 8 && this.loginPass.length > 0) {
                        this.loginPass = this.loginPass.substring(0, this.loginPass.length - 1);
                    }

                    if (key === 9 || key === 10 || key === 13) {
                        this.loginSelect = 0;
                    }

                    if (valid) {
                        this.loginPass = this.loginPass + String.fromCharCode(key);
                    }

                    if (this.loginPass.length > 20) {
                        this.loginPass = this.loginPass.substring(0, 20);
                    }
                }
            }
        } else if (this.loginscreen === 3) {
            const x: number = (this.sWid / 2) | 0;
            let y: number = ((this.sHei / 2) | 0) + 50;

            y += 20;
            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                this.loginscreen = 0;
            }
        }
    }

    private async drawTitle(): Promise<void> {
        await this.loadTitle();
        this.imageTitle4?.setPixels();
        this.imageTitlebox?.plotSprite(0, 0);

        const w: number = 360;
        const h: number = 200;

        if (this.loginscreen === 0) {
            const extraY: number = ((h / 2) | 0) + 80;
            let y: number = ((h / 2) | 0) - 20;

            if (this.onDemand) {
                this.p11?.centreStringTag(this.onDemand.message, w / 2, extraY, 0x75a9a9, true);
            }

            this.b12?.centreStringTag('Welcome to RuneScape', w / 2, y, Colour.YELLOW, true);
            y += 30;

            let x = ((w / 2) | 0) - 80;
            y = ((h / 2) | 0) + 20;
            this.imageTitlebutton?.plotSprite(x - 73, y - 20);
            this.b12?.centreStringTag('New User', x, y + 5, Colour.WHITE, true);

            x = ((w / 2) | 0) + 80;
            this.imageTitlebutton?.plotSprite(x - 73, y - 20);
            this.b12?.centreStringTag('Existing User', x, y + 5, Colour.WHITE, true);
        } else if (this.loginscreen === 2) {
            let x: number = ((w / 2) | 0) - 80;
            let y: number = ((h / 2) | 0) - 40;
            if (this.loginMes1.length > 0) {
                this.b12?.centreStringTag(this.loginMes1, w / 2, y - 15, Colour.YELLOW, true);
                this.b12?.centreStringTag(this.loginMes2, w / 2, y, Colour.YELLOW, true);
                y += 30;
            } else {
                this.b12?.centreStringTag(this.loginMes2, w / 2, y - 7, Colour.YELLOW, true);
                y += 30;
            }

            this.b12?.drawStringTag(`Username: ${this.loginUser}${this.loginSelect === 0 && Client.loopCycle % 40 < 20 ? '@yel@|' : ''}`, w / 2 - 90, y, Colour.WHITE, true);
            y += 15;

            this.b12?.drawStringTag(`Password: ${JString.getRepeatedCharacter(this.loginPass)}${this.loginSelect === 1 && Client.loopCycle % 40 < 20 ? '@yel@|' : ''}`, w / 2 - 88, y, Colour.WHITE, true);
            y += 15;

            x = ((w / 2) | 0) - 80;
            y = ((h / 2) | 0) + 50;
            this.imageTitlebutton?.plotSprite(x - 73, y - 20);
            this.b12?.centreStringTag('Login', x, y + 5, Colour.WHITE, true);

            x = ((w / 2) | 0) + 80;
            this.imageTitlebutton?.plotSprite(x - 73, y - 20);
            this.b12?.centreStringTag('Cancel', x, y + 5, Colour.WHITE, true);
        } else if (this.loginscreen === 3) {
            let x: number = (w / 2) | 0;
            let y: number = ((h / 2) | 0) - 60;
            this.b12?.centreStringTag('Create a free account', x, y, Colour.YELLOW, true);

            y = ((h / 2) | 0) - 35;
            // Java 377 drawTitle titleScreenState==3 copy
            this.b12?.centreStringTag('To create a new account you need to', x, y, Colour.WHITE, true);
            y += 15;

            this.b12?.centreStringTag('go back to the main RuneScape webpage', x, y, Colour.WHITE, true);
            y += 15;

            this.b12?.centreStringTag("and choose the 'create account'", x, y, Colour.WHITE, true);
            y += 15;

            this.b12?.centreStringTag('button near the top of that page.', x, y, Colour.WHITE, true);
            y += 15;

            x = (w / 2) | 0;
            y = ((h / 2) | 0) + 50;
            this.imageTitlebutton?.plotSprite(x - 73, y - 20);
            this.b12?.centreStringTag('Cancel', x, y + 5, Colour.WHITE, true);
        }

        this.imageTitle4?.draw(202, 171);

        if (this.redrawFrame) {
            this.redrawFrame = false;
            this.imageTitle2?.draw(128, 0);
            this.imageTitle3?.draw(202, 371);
            this.imageTitle5?.draw(0, 265);
            this.imageTitle6?.draw(562, 265);
            this.imageTitle7?.draw(128, 171);
            this.imageTitle8?.draw(562, 171);
        }
    }

    private async loadTitle(): Promise<void> {
        if (this.imageTitle2) {
            return;
        }

        this.drawArea = null;
        this.areaChat = null;
        this.areaMap = null;
        this.areaSide = null;
        this.areaGame = null;
        this.areaBackbase1 = null;
        this.areaBackbase2 = null;
        this.areaBackhmid1 = null;

        this.imageTitle0 = new PixMap(128, 265);
        Pix2D.cls();

        this.imageTitle1 = new PixMap(128, 265);
        Pix2D.cls();

        this.imageTitle2 = new PixMap(509, 171);
        Pix2D.cls();

        this.imageTitle3 = new PixMap(360, 132);
        Pix2D.cls();

        this.imageTitle4 = new PixMap(360, 200);
        Pix2D.cls();

        this.imageTitle5 = new PixMap(202, 238);
        Pix2D.cls();

        this.imageTitle6 = new PixMap(203, 238);
        Pix2D.cls();

        this.imageTitle7 = new PixMap(74, 94);
        Pix2D.cls();

        this.imageTitle8 = new PixMap(75, 94);
        Pix2D.cls();

        if (this.title) {
            await this.loadTitleBackground();
            this.loadTitleImages();
        }

        this.redrawFrame = true;
    }

    private async loadTitleBackground(): Promise<void> {
        if (!this.title) {
            return;
        }

        const background: Pix32 = await Pix32.fromJpeg(this.title, 'title.dat');

        this.imageTitle0?.setPixels();
        background.quickPlotSprite(0, 0);

        this.imageTitle1?.setPixels();
        background.quickPlotSprite(-637, 0);

        this.imageTitle2?.setPixels();
        background.quickPlotSprite(-128, 0);

        this.imageTitle3?.setPixels();
        background.quickPlotSprite(-202, -371);

        this.imageTitle4?.setPixels();
        background.quickPlotSprite(-202, -171);

        this.imageTitle5?.setPixels();
        background.quickPlotSprite(0, -265);

        this.imageTitle6?.setPixels();
        background.quickPlotSprite(-562, -265);

        this.imageTitle7?.setPixels();
        background.quickPlotSprite(-128, -171);

        this.imageTitle8?.setPixels();
        background.quickPlotSprite(-562, -171);

        // draw right side (mirror image)
        background.hflip();

        this.imageTitle0?.setPixels();
        background.quickPlotSprite(382, 0);

        this.imageTitle1?.setPixels();
        background.quickPlotSprite(-255, 0);

        this.imageTitle2?.setPixels();
        background.quickPlotSprite(254, 0);

        this.imageTitle3?.setPixels();
        background.quickPlotSprite(180, -371);

        this.imageTitle4?.setPixels();
        background.quickPlotSprite(180, -171);

        this.imageTitle5?.setPixels();
        background.quickPlotSprite(382, -265);

        this.imageTitle6?.setPixels();
        background.quickPlotSprite(-180, -265);

        this.imageTitle7?.setPixels();
        background.quickPlotSprite(254, -171);

        this.imageTitle8?.setPixels();
        background.quickPlotSprite(-180, -171);

        const logo: Pix32 = Pix32.depack(this.title, 'logo');
        this.imageTitle2?.setPixels();
        logo.plotSprite(((this.sWid / 2) | 0) - ((logo.wi / 2) | 0) - 128, 18);
    }

    private loadTitleImages(): void {
        if (!this.title) {
            return;
        }

        this.imageTitlebox = Pix8.depack(this.title, 'titlebox');
        this.imageTitlebutton = Pix8.depack(this.title, 'titlebutton');

        // Java 377 loadTitleImages: always runes 0..11 (fl_icon param removed vs 289)
        for (let i: number = 0; i < 12; i++) {
            this.imageRunes[i] = Pix8.depack(this.title, 'runes', i);
        }

        this.drawProgress('Connecting to fileserver', 10).then((): void => {
            if (!this.titleFlames && this.imageTitle0 && this.imageTitle1) {
                this.titleFlames = new TitleFlames(this.imageRunes);
                this.titleFlames.setupFire(this.imageTitle0, this.imageTitle1);
                this.titleFlames.start();
            }
        });
    }

    /**
     * Java `Client.login` (377). Success path, reply codes 18/22–26, hop timer,
     * and -1 silent-retry via loginRetryCount. Do not invent wire bytes.
     */
    private async login(username: string, password: string, reconnect: boolean): Promise<void> {
        try {
            if (!reconnect) {
                this.loginMes1 = '';
                this.loginMes2 = 'Connecting to server...';
                await this.drawTitle();
            }

            this.stream = new ClientStream(await ClientStream.openSocket(window.location.host, window.location.protocol === 'https:'));

            const userhash = JString.toUserhash(username);
            const loginServer = Number(userhash >> 16n) & 0x1f;

            this.out.pos = 0;
            this.out.p1(14);
            this.out.p1(loginServer);

            this.stream.write(this.out.data, 2);
            for (let i = 0; i < 8; i++) {
                await this.stream.read();
            }

            // Java: int var8 = stream.read(); int var9 = var8;  (var9 = first reply, pre-RSA)
            let response: number = await this.stream.read();
            const firstReply: number = response;
            if (response === 0) {
                await this.stream.readBytes(this.in.data, 0, 8);
                this.in.pos = 0;

                this.loginSeed = this.in.g8();
                const seed: Int32Array = new Int32Array([
                    Math.floor(Math.random() * 99999999),
                    Math.floor(Math.random() * 99999999),
                    Number(this.loginSeed >> 32n),
                    Number(this.loginSeed & BigInt(0xffffffff))
                ]);

                this.out.pos = 0;
                this.out.p1(10);
                this.out.p4(seed[0]);
                this.out.p4(seed[1]);
                this.out.p4(seed[2]);
                this.out.p4(seed[3]);
                this.out.p4(1337); // uid
                this.out.pjstr(username);
                this.out.pjstr(password);
                this.out.rsaenc(BigInt(process.env.LOGIN_RSAN!), BigInt(process.env.LOGIN_RSAE!));

                this.loginout.pos = 0;
                if (reconnect) {
                    this.loginout.p1(18);
                } else {
                    this.loginout.p1(16);
                }

                // Java 377: out.pos + 36 + 1 + 1 + 2
                this.loginout.p1(this.out.pos + 36 + 1 + 1 + 2);
                this.loginout.p1(255);
                this.loginout.p2(CLIENT_VERSION);
                this.loginout.p1(Client.lowMem ? 1 : 0);

                for (let i: number = 0; i < 9; i++) {
                    this.loginout.p4(this.jagChecksum[i]);
                }

                this.loginout.pdata(this.out.data, 0, this.out.pos);
                this.out.random = new Isaac(seed);
                for (let i: number = 0; i < 4; i++) {
                    seed[i] += 50;
                }
                this.randomIn = new Isaac(seed);
                this.stream?.write(this.loginout.data, this.loginout.pos);

                response = await this.stream.read();
            }

            if (response === 1) {
                await sleep(2000);
                await this.login(username, password, reconnect);
            } else if (response === 2) {
                this.staffmodlevel = await this.stream.read();
                this.mouseTracked = (await this.stream.read()) === 1;

                this.prevMouseClickTime = 0;
                this.mouseTrackDelta = 0;
                this.mouseTracking.length = 0;
                this.focus = true;
                this.focusIn = true;
                this.ingame = true;
                this.out.pos = 0;
                this.in.pos = 0;
                this.ptype = -1;
                this.ptype0 = -1;
                this.ptype1 = -1;
                this.ptype2 = -1;
                this.psize = 0;
                this.timeoutTimer = performance.now();
                this.rebootTimer = 0;
                this.logoutTimer = 0;
                this.hintType = 0;
                this.menuNumEntries = 0;
                this.isMenuOpen = false;
                this.idleTimer = performance.now();

                for (let i: number = 0; i < 100; i++) {
                    this.chatText[i] = null;
                }

                this.useMode = 0;
                this.targetMode = 0;
                this.sceneState = 0;
                this.waveCount = 0;

                this.macroCameraX = ((Math.random() * 100.0) | 0) - 50;
                this.macroCameraZ = ((Math.random() * 110.0) | 0) - 55;
                this.macroCameraAngle = ((Math.random() * 80.0) | 0) - 40;
                this.macroMinimapAngle = ((Math.random() * 120.0) | 0) - 60;
                this.macroMinimapZoom = ((Math.random() * 30.0) | 0) - 20;
                this.orbitCameraYaw = (((Math.random() * 20.0) | 0) - 10) & 0x7ff;

                this.minimapState = 0;
                this.minimapLevel = -1;
                this.minimapFlagX = 0;
                this.minimapFlagZ = 0;

                this.playerCount = 0;
                this.npcCount = 0;

                for (let i: number = 0; i < MAX_PLAYER_COUNT; i++) {
                    this.players[i] = null;
                    this.playerAppearanceBuffer[i] = null;
                }

                for (let i: number = 0; i < 16384; i++) {
                    this.npc[i] = null;
                }

                this.localPlayer = this.players[LOCAL_PLAYER_INDEX] = new ClientPlayer();

                this.projectiles.clear();
                this.spotanims.clear();

                for (let level: number = 0; level < BuildArea.LEVELS; level++) {
                    for (let x: number = 0; x < BuildArea.SIZE; x++) {
                        for (let z: number = 0; z < BuildArea.SIZE; z++) {
                            this.groundObj[level][x][z] = null;
                        }
                    }
                }

                this.locChanges = new LinkList();
                this.friendServerStatus = 0;
                this.friendCount = 0;

                // Java 377: unloadCom each sticky/modal id before reset
                this.unloadCom(this.tutComId);
                this.tutComId = -1;
                this.unloadCom(this.chatModalId);
                this.chatModalId = -1;
                this.unloadCom(this.mainModalId);
                this.mainModalId = -1;
                this.unloadCom(this.fullscreenInterfaceId0);
                this.fullscreenInterfaceId0 = -1;
                this.unloadCom(this.fullscreenInterfaceId1);
                this.fullscreenInterfaceId1 = -1;
                this.unloadCom(this.sideModalId);
                this.sideModalId = -1;
                this.unloadCom(this.mainOverlayId);
                this.mainOverlayId = -1;

                this.resumedPauseButton = false;
                this.activeIcon = 3;
                this.dialogInputOpen = false;
                this.chatbackInputOpen = 0;
                this.isMenuOpen = false;
                this.socialInputOpen = false;
                this.tutComMessage = null;
                this.inMultizone = 0;
                this.tutFlashIcon = -1;

                this.idkDesignGender = true;
                this.validateCharacterDesign();
                for (let i: number = 0; i < 5; i++) {
                    this.idkDesignColour[i] = 0;
                }

                for (let i = 0; i < 5; i++) {
                    this.playerOp[i] = null;
                    this.playerOpPriority[i] = false;
                }

                Client.oplogic1 = 0;
                Client.oplogic2 = 0;
                Client.oplogic3 = 0;
                Client.oplogic4 = 0;
                Client.oplogic5 = 0;
                Client.oplogic6 = 0;
                Client.oplogic7 = 0;
                Client.oplogic8 = 0;
                Client.oplogic9 = 0;
                Client.oplogic10 = 0;

                this.prepareGame();
            } else if (response === 3) {
                this.loginMes1 = '';
                this.loginMes2 = 'Invalid username or password.';
            } else if (response === 4) {
                this.loginMes1 = 'Your account has been disabled.';
                this.loginMes2 = 'Please check your message-centre for details.';
            } else if (response === 5) {
                this.loginMes1 = 'Your account is already logged in.';
                this.loginMes2 = 'Try again in 60 secs...';
            } else if (response === 6) {
                this.loginMes1 = 'RuneScape has been updated!';
                this.loginMes2 = 'Please reload this page.';
            } else if (response === 7) {
                this.loginMes1 = 'This world is full.';
                this.loginMes2 = 'Please use a different world.';
            } else if (response === 8) {
                this.loginMes1 = 'Unable to connect.';
                this.loginMes2 = 'Login server offline.';
            } else if (response === 9) {
                this.loginMes1 = 'Login limit exceeded.';
                this.loginMes2 = 'Too many connections from your address.';
            } else if (response === 10) {
                this.loginMes1 = 'Unable to connect.';
                this.loginMes2 = 'Bad session id.';
            } else if (response === 12) {
                this.loginMes1 = 'You need a members account to login to this world.';
                this.loginMes2 = 'Please subscribe, or use a different world.';
            } else if (response === 13) {
                this.loginMes1 = 'Could not complete login.';
                this.loginMes2 = 'Please try using a different world.';
            } else if (response === 14) {
                this.loginMes1 = 'The server is being updated.';
                this.loginMes2 = 'Please wait 1 minute and try again.';
            } else if (response === 15) {
                this.ingame = true;
                this.out.pos = 0;
                this.in.pos = 0;
                this.ptype = -1;
                this.ptype0 = -1;
                this.ptype1 = -1;
                this.ptype2 = -1;
                this.psize = 0;
                this.timeoutTimer = performance.now();
                this.rebootTimer = 0;
                this.menuNumEntries = 0;
                this.isMenuOpen = false;
                this.sceneLoadStartTime = performance.now();
            } else if (response === 16) {
                this.loginMes1 = 'Login attempts exceeded.';
                this.loginMes2 = 'Please wait 1 minute and try again.';
            } else if (response === 17) {
                this.loginMes1 = 'You are standing in a members-only area.';
                this.loginMes2 = 'To play on this world move to a free area first';
            } else if (response === 18) {
                // Java 377 only (not in 289)
                this.loginMes1 = 'Account locked as we suspect it has been stolen.';
                this.loginMes2 = "Press 'recover a locked account' on front page.";
            } else if (response === 20) {
                this.loginMes1 = 'Invalid loginserver requested';
                this.loginMes2 = 'Please try using a different world.';
            } else if (response === 21) {
                // Java 377: for (var26 = hopSeconds + 3; var26 >= 0; var26--) sleep 1200
                const hopSeconds: number = await this.stream.read();
                for (let remaining: number = hopSeconds + 3; remaining >= 0; remaining--) {
                    this.loginMes1 = 'You have only just left another world';
                    this.loginMes2 = 'Your profile will be transferred in: ' + remaining;
                    await this.drawTitle();
                    await sleep(1200);
                }

                await this.login(username, password, reconnect);
            } else if (response === 22) {
                this.loginMes1 = 'Malformed login packet.';
                this.loginMes2 = 'Please try again.';
            } else if (response === 23) {
                this.loginMes1 = 'No reply from loginserver.';
                this.loginMes2 = 'Please try again.';
            } else if (response === 24) {
                this.loginMes1 = 'Error loading your profile.';
                this.loginMes2 = 'Please contact customer support.';
            } else if (response === 25) {
                this.loginMes1 = 'Unexpected loginserver response.';
                this.loginMes2 = 'Please try using a different world.';
            } else if (response === 26) {
                this.loginMes1 = 'This computers address has been blocked';
                this.loginMes2 = 'as it was used to break our rules';
            } else if (response !== -1) {
                console.log('response:' + response);
                this.loginMes1 = 'Unexpected server response';
                this.loginMes2 = 'Please try using a different world.';
            } else if (firstReply !== 0) {
                // -1 after non-zero first reply (pre-RSA failure)
                this.loginMes1 = 'No response from server';
                this.loginMes2 = 'Please try using a different world.';
            } else if (this.loginRetryCount < 2) {
                // -1 after reply 0 (RSA path) — silent retry up to 2 times
                await sleep(2000);
                this.loginRetryCount++;
                await this.login(username, password, reconnect);
            } else {
                this.loginMes1 = 'No response from loginserver';
                this.loginMes2 = 'Please wait 1 minute and try again.';
            }
        } catch (e) {
            if (e instanceof WebSocket && e.readyState === 3) {
                // IO error
                this.loginMes1 = '';
                this.loginMes2 = 'Error connecting to server.';
            } else {
                // exceptions in Java get stuck permanently on "Connecting to server..."
                throw e;
            }
        }
    }

    private unloadTitle(): void {
        this.titleFlames?.close();
        this.titleFlames = null;

        this.imageTitlebox = null;
        this.imageTitlebutton = null;
        this.imageRunes = [];
    }

    /**
     * Port of Client-Java `prepareGame` (377).
     * Java: PixMap(h, component, w); areaViewport.bind() + Pix3D.lineOffset at end.
     * TS PixMap is (w, h); bind ≡ setPixels + restore gameScanline.
     */
    private prepareGame(): void {
        if (this.areaChat) {
            return;
        }

        this.unloadTitle();

        this.drawArea = null;
        this.imageTitle2 = null;
        this.imageTitle3 = null;
        this.imageTitle4 = null;
        this.imageTitle0 = null;
        this.imageTitle1 = null;
        this.imageTitle5 = null;
        this.imageTitle6 = null;
        this.imageTitle7 = null;
        this.imageTitle8 = null;

        // Java: areaChatback = new PixMap(96, …, 479)
        this.areaChat = new PixMap(479, 96);

        // Java: areaMapback = new PixMap(156, …, 172); Pix2D.cls(); imageMapback.plotSprite
        this.areaMap = new PixMap(172, 156);
        this.areaMap.setPixels();
        Pix2D.cls();
        this.mapback?.plotSprite(0, 0);

        // Java: areaSidebar = new PixMap(261, …, 190)
        this.areaSide = new PixMap(190, 261);

        // Java: areaViewport = new PixMap(334, …, 512); Pix2D.cls();
        this.areaGame = new PixMap(512, 334);
        Pix2D.cls();

        // Java: areaBackbase1/2, areaBackmid1
        this.areaBackbase1 = new PixMap(496, 50);
        this.areaBackbase2 = new PixMap(269, 37);
        this.areaBackhmid1 = new PixMap(249, 45);

        this.redrawFrame = true;
        // Java: after chrome PixMaps — areaViewport.bind(); Pix3D.lineOffset = areaViewportOffset
        this.bindGameViewport();
    }

    /**
     * Java `prepareFullGame` — full 765×503 surface for IF_OPENFULL.
     * Nulls chrome PixMaps so prepareGame rebuilds them after close.
     */
    private prepareFullGame(): void {
        if (this.drawArea) {
            return;
        }

        this.unloadTitle();

        this.imageTitle2 = null;
        this.imageTitle3 = null;
        this.imageTitle4 = null;
        this.imageTitle0 = null;
        this.imageTitle1 = null;
        this.imageTitle5 = null;
        this.imageTitle6 = null;
        this.imageTitle7 = null;
        this.imageTitle8 = null;

        this.areaChat = null;
        this.areaMap = null;
        this.areaSide = null;
        this.areaGame = null;
        this.areaBackbase1 = null;
        this.areaBackbase2 = null;
        this.areaBackhmid1 = null;

        // Java: new PixMap(503, component, 765) → TS (w, h)
        this.drawArea = new PixMap(765, 503);
    }

    private async updateGame(): Promise<void> {
        if (this.players === null) {
            // client is unloading asynchronously
            return;
        }

        if (this.rebootTimer > 1) {
            this.rebootTimer--;
        }

        if (this.logoutTimer > 0) {
            this.logoutTimer--;
        }

        for (let i: number = 0; i < 5 && (await this.readPacket()); i++) {
            // empty
        }

        const now = performance.now();

        if (!this.ingame) {
            return;
        }

        if (!this.mouseTracked) {
            this.mouseTracking.length = 0;
        } else if (this.mouseClickButton !== 0 || this.mouseTracking.length >= 40) {
            this.out.p1Enc(ClientProt.EVENT_MOUSE_MOVE);
            this.out.p1(0);
            const start = this.out.pos;
            let count = 0;

            // custom: Java client checks `start - this.out.pos < 240` but this is obviously wrong
            //   and will lead to an invalid packet if the user is buffering a lot of mouse movements (i.e. while disconnected)
            for (let i = 0; i < this.mouseTracking.length && this.out.pos - start < 240; i++) {
                count++;

                let y = this.mouseTracking.y[i];
                if (y < 0) {
                    y = 0;
                } else if (y > 502) {
                    y = 502;
                }

                let x = this.mouseTracking.x[i];
                if (x < 0) {
                    x = 0;
                } else if (x > 764) {
                    x = 764;
                }

                let pos = y * 765 + x;
                if (this.mouseTracking.y[i] === -1 && this.mouseTracking.x[i] === -1) {
                    x = -1;
                    y = -1;
                    pos = 0x7ffff;
                }

                if (x !== this.mouseTrackedX || y !== this.mouseTrackedY) {
                    let dx = x - this.mouseTrackedX;
                    this.mouseTrackedX = x;
                    let dy = y - this.mouseTrackedY;
                    this.mouseTrackedY = y;

                    if (this.mouseTrackDelta < 8 && dx >= -32 && dx <= 31 && dy >= -32 && dy <= 31) {
                        dx += 32;
                        dy += 32;
                        this.out.p2((this.mouseTrackDelta << 12) + (dx << 6) + dy);
                        this.mouseTrackDelta = 0;
                    } else if (this.mouseTrackDelta < 8) {
                        this.out.p3(0x800000 + (this.mouseTrackDelta << 19) + pos);
                        this.mouseTrackDelta = 0;
                    } else {
                        this.out.p4(0xc0000000 + (this.mouseTrackDelta << 19) + pos);
                        this.mouseTrackDelta = 0;
                    }
                } else if (this.mouseTrackDelta < 2047) {
                    this.mouseTrackDelta++;
                }
            }

            this.out.psize1(this.out.pos - start);

            if (count >= this.mouseTracking.length) {
                this.mouseTracking.length = 0;
            } else {
                this.mouseTracking.length -= count;

                for (let i = 0; i < this.mouseTracking.length; i++) {
                    this.mouseTracking.x[i] = this.mouseTracking.x[i + count];
                    this.mouseTracking.y[i] = this.mouseTracking.y[i + count];
                }
            }
        }

        if (this.mouseClickButton !== 0) {
            let delta = ((this.mouseClickTime - this.prevMouseClickTime) / 50) | 0;
            if (delta > 4095) {
                delta = 4095;
            }

            this.prevMouseClickTime = this.mouseClickTime;

            let y = this.mouseClickY;
            if (y < 0) {
                y = 0;
            } else if (y > 502) {
                y = 502;
            }

            let x = this.mouseClickX;
            if (x < 0) {
                x = 0;
            } else if (x > 764) {
                x = 764;
            }

            const pos = y * 765 + x;

            let button = 0;
            if (this.mouseClickButton === 2) {
                button = 1;
            }

            this.out.p1Enc(ClientProt.EVENT_MOUSE_CLICK);
            this.out.p4((delta << 20) + (button << 19) + pos);
        }

        if (this.sendCameraDelay > 0) {
            this.sendCameraDelay--;
        }

        if (this.keyHeld[1] === 1 || this.keyHeld[2] === 1 || this.keyHeld[3] === 1 || this.keyHeld[4] === 1) {
            this.sendCamera = true;
        }

        if (this.sendCamera && this.sendCameraDelay <= 0) {
            this.sendCameraDelay = 20;
            this.sendCamera = false;
            writeCameraPosition(this.out, this.orbitCameraPitch, this.orbitCameraYaw);
        }

        if (this.focus && !this.focusIn) {
            this.focusIn = true;
            this.out.p1Enc(ClientProt.EVENT_APPLET_FOCUS);
            this.out.p1(1);
        } else if (!this.focus && this.focusIn) {
            this.focusIn = false;
            this.out.p1Enc(ClientProt.EVENT_APPLET_FOCUS);
            this.out.p1(0);
        }

        this.updateSceneState();
        this.updateLocChanges();
        await this.updateAudio();

        if (now - this.timeoutTimer > 15_000) {
            // no packets received recently, connection lost
            await this.tryReconnect();
        }

        this.updatePlayers();
        this.updateNpcs();
        this.updateEntityChats();

        this.worldUpdateNum++;

        // Java field189 tooltip delay: hold hover until 100 before draw type-8 tooltip
        if (this.overTooltipMain === 0 && this.overTooltipSide === 0 && this.overTooltipChat === 0) {
            if (this.tooltipTimer > 0) {
                this.tooltipTimer--;
            }
        } else if (this.tooltipTimer < 100) {
            this.tooltipTimer++;
            if (this.tooltipTimer === 100) {
                if (this.overTooltipChat !== 0) {
                    this.redrawChat = true;
                }
                if (this.overTooltipSide !== 0) {
                    this.redrawSide = true;
                }
            }
        }

        if (this.crossMode !== 0) {
            this.crossCycle += 20;

            if (this.crossCycle >= 400) {
                this.crossMode = 0;
            }
        }

        if (this.selectedArea !== 0) {
            this.selectedCycle++;

            if (this.selectedCycle >= 15) {
                if (this.selectedArea === 2) {
                    this.redrawSide = true;
                }
                if (this.selectedArea === 3) {
                    this.redrawChat = true;
                }

                this.selectedArea = 0;
            }
        }

        if (this.objDragArea !== 0) {
            this.objDragCycles++;

            if (this.mouseX > this.objGrabX + 5 || this.mouseX < this.objGrabX - 5 || this.mouseY > this.objGrabY + 5 || this.mouseY < this.objGrabY - 5) {
                this.objGrabThreshold = true;
            }

            if (this.mouseButton === 0) {
                if (this.objDragArea === 2) {
                    this.redrawSide = true;
                }
                if (this.objDragArea === 3) {
                    this.redrawChat = true;
                }

                this.objDragArea = 0;

                if (this.objGrabThreshold && this.objDragCycles >= 5) {
                    this.hoveredSlotComId = -1;
                    this.handleInput();

                    // Java 377: Component.get + mode + swap + INV_BUTTOND in one block
                    if (this.hoveredSlotComId === this.objDragComId && this.hoveredSlot !== this.objDragSlot) {
                        const com = IfType.get(this.objDragComId);
                        if (com) {
                            let mode = 0;
                            if (this.bankArrangeMode == 1 && com.clientCode == ClientCode.CC_BANKMODE) {
                                mode = 1;
                            }
                            if (com.linkObjType && com.linkObjType[this.hoveredSlot] <= 0) {
                                mode = 0;
                            }

                            if (com.objReplace && com.linkObjType && com.linkObjNumber) {
                                const src = this.objDragSlot;
                                const dst = this.hoveredSlot;

                                com.linkObjType[dst] = com.linkObjType[src];
                                com.linkObjNumber[dst] = com.linkObjNumber[src];
                                com.linkObjType[src] = -1;
                                com.linkObjNumber[src] = 0;
                            } else if (mode == 1) {
                                let src = this.objDragSlot;
                                const dst = this.hoveredSlot;

                                while (src != dst) {
                                    if (src > dst) {
                                        com.swapSlots(src, src - 1);
                                        src--;
                                    } else if (src < dst) {
                                        com.swapSlots(src, src + 1);
                                        src++;
                                    }
                                }
                            } else {
                                com.swapSlots(this.objDragSlot, this.hoveredSlot);
                            }

                            // Engine InvButtonDDecoder: targetSlot g2_alt3, mode g1_alt1, com g2_alt2, slot g2_alt1
                            this.out.p1Enc(ClientProt.INV_BUTTOND);
                            this.out.p2_alt3(this.hoveredSlot);
                            this.out.p1_alt1(mode);
                            this.out.p2_alt2(this.objDragComId);
                            this.out.p2_alt1(this.objDragSlot);
                        }
                    }
                } else if ((this.oneMouseButton === 1 || this.isAddFriendOption(this.menuNumEntries - 1)) && this.menuNumEntries > 2) {
                    this.showContextMenu();
                } else if (this.menuNumEntries > 0) {
                    this.useMenuOption(this.menuNumEntries - 1);
                }

                this.selectedCycle = 10;
                this.mouseClickButton = 0;
            }
        }

        // Java 377 has CYCLELOGIC1–6 only; CYCLELOGIC7 was 289-era and must not be sent
        // (p1Enc(-1) → server opcode 255 → NetworkPlayer closes connection).
        Client.cyclelogic7++;
        if (Client.cyclelogic7 > 62) {
            Client.cyclelogic7 = 0;
        }

        if (World.groundX !== -1) {
            if (this.localPlayer) {
                const x: number = World.groundX;
                const z: number = World.groundZ;
                const success: boolean = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], x, z, true, 0, 0, 0, 0, 0, 0);
                World.groundX = -1;

                if (success) {
                    this.crossX = this.mouseClickX;
                    this.crossY = this.mouseClickY;
                    this.crossMode = 1;
                    this.crossCycle = 0;
                }
            }
        }

        if (this.mouseClickButton === 1 && this.tutComMessage) {
            this.tutComMessage = null;
            this.redrawChat = true;
            this.mouseClickButton = 0;
        }

        // Java handleMouseInput always; minimap/tab/chatMode only when no fullscreen IF
        const checkClickInput = !this.isMobile || (this.isMobile && !MobileKeyboard.isWithinCanvasKeyboard(this.mouseClickX, this.mouseClickY));

        if (checkClickInput) {
            this.handleMouseInput();
            // Java: if (fullscreenInterfaceId0 == -1) { handleMinimapInput; handleTabInput; handleChatModeInput; }
            if (this.fullscreenInterfaceId0 === -1) {
                this.handleMinimapInput();
                this.handleTabInput();
                this.handleChatModeInput();
            }
        }

        if (this.mouseButton === 1 || this.mouseClickButton === 1) {
            this.scrollCycle++;
        }

        if (this.sceneState === 2) {
            this.updateOrbitCamera();
        }
        if (this.sceneState === 2 && this.cinemaCam) {
            this.applyCutscene();
        }

        for (let i: number = 0; i < 5; i++) {
            this.camShakeCycle[i]++;
        }

        await this.handleInputKey();

        if (now - this.idleTimer > 90_000) {
            // no input in 90s, notify the server
            this.logoutTimer = 250;
            this.idleTimer += 10_000; // 10s backoff

            this.out.p1Enc(ClientProt.IDLE_TIMER);
        }

        this.macroCameraCycle++;
        if (this.macroCameraCycle > 500) {
            this.macroCameraCycle = 0;

            const rand: number = (Math.random() * 8.0) | 0;
            if ((rand & 0x1) === 1) {
                this.macroCameraX += this.macroCameraXModifier;
            }
            if ((rand & 0x2) === 2) {
                this.macroCameraZ += this.macroCameraZModifier;
            }
            if ((rand & 0x4) === 4) {
                this.macroCameraAngle += this.macroCameraAngleModifier;
            }
        }

        if (this.macroCameraX < -50) {
            this.macroCameraXModifier = 2;
        }
        if (this.macroCameraX > 50) {
            this.macroCameraXModifier = -2;
        }

        if (this.macroCameraZ < -55) {
            this.macroCameraZModifier = 2;
        }
        if (this.macroCameraZ > 55) {
            this.macroCameraZModifier = -2;
        }

        if (this.macroCameraAngle < -40) {
            this.macroCameraAngleModifier = 1;
        }
        if (this.macroCameraAngle > 40) {
            this.macroCameraAngleModifier = -1;
        }

        this.macroMinimapCycle++;
        if (this.macroMinimapCycle > 500) {
            this.macroMinimapCycle = 0;

            const rand: number = (Math.random() * 8.0) | 0;
            if ((rand & 0x1) === 1) {
                this.macroMinimapAngle += this.macroMinimapAngleModifier;
            }
            if ((rand & 0x2) === 2) {
                this.macroMinimapZoom += this.macroMinimapZoomModifier;
            }
        }

        if (this.macroMinimapAngle < -60) {
            this.macroMinimapAngleModifier = 2;
        }
        if (this.macroMinimapAngle > 60) {
            this.macroMinimapAngleModifier = -2;
        }

        if (this.macroMinimapZoom < -20) {
            this.macroMinimapZoomModifier = 1;
        }
        if (this.macroMinimapZoom > 10) {
            this.macroMinimapZoomModifier = -1;
        }

        if (now - this.noTimeoutTimer > 1_000) {
            // nothing sent in the last 1s, keep the client connected
            this.out.p1Enc(ClientProt.NO_TIMEOUT);
        }

        try {
            if (this.stream && this.out.pos > 0) {
                this.stream.write(this.out.data, this.out.pos);
                this.out.pos = 0;
                this.noTimeoutTimer = now;
            }
        } catch (e) {
            if (e instanceof WebSocket && e.readyState === 3) {
                // IO error
                await this.tryReconnect();
            } else {
                // logic error
                await this.logout();
            }
        }
    }

    private async logout(): Promise<void> {
        if (this.stream) {
            this.stream.close();
        }

        this.stream = null;
        this.ingame = false;
        this.loginscreen = 0;
        this.loginUser = '';
        this.loginPass = '';

        this.clearCache();
        this.world?.resetMap();

        for (let level: number = 0; level < BuildArea.LEVELS; level++) {
            this.collision[level]?.reset();
        }

        stopMidi(false);
        this.nextMidiSong = -1;
        this.midiSong = -1;
        this.nextMusicDelay = 0;
    }

    private clearCache(): void {
        LocType.mc1?.clear();
        LocType.mc2?.clear();
        NpcType.modelCache?.clear();
        ObjType.modelCache?.clear();
        ObjType.spriteCache?.clear();
        ClientPlayer.modelCache?.clear();
        SpotType.modelCache?.clear();
    }

    private async tryReconnect() {
        if (this.logoutTimer > 0) {
            await this.logout();
            return;
        }

        this.areaGame?.setPixels();
        this.p12?.centreString('Connection lost', 257, 144, Colour.BLACK);
        this.p12?.centreString('Connection lost', 256, 143, Colour.WHITE);
        this.p12?.centreString('Please wait - attempting to reestablish', 257, 159, Colour.BLACK);
        this.p12?.centreString('Please wait - attempting to reestablish', 256, 158, Colour.WHITE);
        this.areaGame?.draw(4, 4);

        this.minimapState = 0;
        this.minimapFlagX = 0;

        const oldStream = this.stream;

        // Java tryReconnect: loginRetryCount = 0 before reconnect login
        this.ingame = false;
        this.loginRetryCount = 0;
        await this.login(this.loginUser, this.loginPass, true);
        if (!this.ingame) {
            await this.logout();
        }

        oldStream?.close();
    }

    // todo: order
    private handleInput(): void {
        if (this.objDragArea !== 0) {
            return;
        }

        this.menuOption[0] = 'Cancel';
        this.menuAction[0] = MiniMenuAction.CANCEL;
        this.menuNumEntries = 1;

        // Java: fullscreenInterfaceId0 takes over all input
        if (this.fullscreenInterfaceId0 !== -1) {
            this.lastOverComId = 0;
            this.tooltipHoverComId = 0;
            // Java handleInterfaceInput area=0 (viewport/fullscreen)
            this.handleInterfaceInput(IfType.get(this.fullscreenInterfaceId0), this.mouseX, this.mouseY, 0, 0, 0, 0);
            if (this.lastOverComId !== this.overMainComId) {
                this.overMainComId = this.lastOverComId;
            }
            if (this.tooltipHoverComId !== this.overTooltipMain) {
                this.overTooltipMain = this.tooltipHoverComId;
            }
            return;
        }

        this.handlePrivateChatInput();
        this.lastOverComId = 0;
        this.tooltipHoverComId = 0;

        if (this.mouseX > 4 && this.mouseY > 4 && this.mouseX < 516 && this.mouseY < 338) {
            if (this.mainModalId === -1) {
                this.handleViewportOptions();
            } else {
                // Java: handleInterfaceInput(4, viewportInterface, 0, 0, 4, mouseX, mouseY)
                this.handleInterfaceInput(IfType.get(this.mainModalId), this.mouseX, this.mouseY, 4, 4, 0, 0);
            }
        }

        if (this.lastOverComId !== this.overMainComId) {
            this.overMainComId = this.lastOverComId;
        }

        // Java field425 — viewport tooltip target
        if (this.tooltipHoverComId !== this.overTooltipMain) {
            this.overTooltipMain = this.tooltipHoverComId;
        }

        this.lastOverComId = 0;
        this.tooltipHoverComId = 0;

        if (this.mouseX > 553 && this.mouseY > 205 && this.mouseX < 743 && this.mouseY < 466) {
            if (this.sideModalId !== -1) {
                // Java area=1 sidebar
                this.handleInterfaceInput(IfType.get(this.sideModalId), this.mouseX, this.mouseY, 553, 205, 0, 1);
            } else if (this.sideIcon[this.activeIcon] !== -1) {
                this.handleInterfaceInput(IfType.get(this.sideIcon[this.activeIcon]), this.mouseX, this.mouseY, 553, 205, 0, 1);
            }
        }

        if (this.lastOverComId !== this.overSideComId) {
            this.redrawSide = true;
            this.overSideComId = this.lastOverComId;
        }

        // Java field340 — sidebar tooltip target
        if (this.tooltipHoverComId !== this.overTooltipSide) {
            this.redrawSide = true;
            this.overTooltipSide = this.tooltipHoverComId;
        }

        this.lastOverComId = 0;
        this.tooltipHoverComId = 0;

        // Java 377 handleInput chat region:
        //   chatInterfaceId → area 2; stickyChatInterfaceId → area 3; else free chat.
        // TS: chatModalId = chatInterfaceId, tutComId = stickyChatInterfaceId.
        if (this.mouseX > 17 && this.mouseY > 357 && this.mouseX < 496 && this.mouseY < 453) {
            if (this.chatModalId !== -1) {
                this.handleInterfaceInput(IfType.get(this.chatModalId), this.mouseX, this.mouseY, 17, 357, 0, 2);
            } else if (this.tutComId !== -1) {
                this.handleInterfaceInput(IfType.get(this.tutComId), this.mouseX, this.mouseY, 17, 357, 0, 3);
            } else if (this.mouseY < 434 && this.mouseX < 426 && this.chatbackInputOpen === 0) {
                this.handleChatMouseInput(this.mouseX - 17, this.mouseY - 357);
            }
        }

        if ((this.chatModalId !== -1 || this.tutComId !== -1) && this.lastOverComId !== this.overChatComId) {
            this.redrawChat = true;
            this.overChatComId = this.lastOverComId;
        }

        // Java field580 — chat tooltip target (chat modal OR sticky)
        if ((this.chatModalId !== -1 || this.tutComId !== -1) && this.tooltipHoverComId !== this.overTooltipChat) {
            this.redrawChat = true;
            this.overTooltipChat = this.tooltipHoverComId;
        }

        let sorted: boolean = false;
        while (!sorted) {
            sorted = true;

            for (let i: number = 0; i < this.menuNumEntries - 1; i++) {
                if (this.menuAction[i] < 1000 && this.menuAction[i + 1] > 1000) {
                    const tmp0: string = this.menuOption[i];
                    this.menuOption[i] = this.menuOption[i + 1];
                    this.menuOption[i + 1] = tmp0;

                    const tmp1: number = this.menuAction[i];
                    this.menuAction[i] = this.menuAction[i + 1];
                    this.menuAction[i + 1] = tmp1;

                    const tmp2: number = this.menuParamB[i];
                    this.menuParamB[i] = this.menuParamB[i + 1];
                    this.menuParamB[i + 1] = tmp2;

                    const tmp3: number = this.menuParamC[i];
                    this.menuParamC[i] = this.menuParamC[i + 1];
                    this.menuParamC[i + 1] = tmp3;

                    const tmp4: number = this.menuParamA[i];
                    this.menuParamA[i] = this.menuParamA[i + 1];
                    this.menuParamA[i + 1] = tmp4;

                    sorted = false;
                }
            }
        }
    }

    // todo: order
    private handlePrivateChatInput(): void {
        if (this.splitPrivateChat === 0) {
            return;
        }

        let line: number = 0;
        if (this.rebootTimer !== 0) {
            line = 1;
        }

        for (let i: number = 0; i < 100; i++) {
            if (this.chatText[i] !== null) {
                const type: number = this.chatType[i];
                let sender = this.chatUsername[i];

                let _mod = false;
                if (sender && sender.startsWith('@cr1@')) {
                    sender = sender.substring(5);
                    _mod = true;
                } else if (sender && sender.startsWith('@cr2@')) {
                    sender = sender.substring(5);
                    _mod = true;
                }

                if ((type === 3 || type === 7) && (type === 7 || this.chatPrivateMode === 0 || (this.chatPrivateMode === 1 && this.isFriend(sender)))) {
                    // Java handlePrivateChatInput: y = 329 - line*13; hit within string width of "From:  name+text"
                    const y: number = 329 - line * 13;

                    if (this.mouseX > 4 && this.mouseY - 4 > y - 10 && this.mouseY - 4 <= y + 3) {
                        let hitW = (this.p12?.stringWidTag('From:  ' + sender + this.chatText[i]) ?? 0) + 25;
                        if (hitW > 450) {
                            hitW = 450;
                        }
                        if (this.mouseX < hitW + 4) {
                            if (this.staffmodlevel) {
                                this.menuOption[this.menuNumEntries] = 'Report abuse @whi@' + sender;
                                this.menuAction[this.menuNumEntries] = MiniMenuAction._PRIORITY + MiniMenuAction.ABUSE_REPORT;
                                this.menuNumEntries++;
                            }

                            this.menuOption[this.menuNumEntries] = 'Add ignore @whi@' + sender;
                            this.menuAction[this.menuNumEntries] = MiniMenuAction._PRIORITY + MiniMenuAction.IGNORELIST_ADD;
                            this.menuNumEntries++;

                            this.menuOption[this.menuNumEntries] = 'Add friend @whi@' + sender;
                            this.menuAction[this.menuNumEntries] = MiniMenuAction._PRIORITY + MiniMenuAction.FRIENDLIST_ADD;
                            this.menuNumEntries++;
                        }
                    }

                    line++;
                    if (line >= 5) {
                        return;
                    }
                } else if ((type === 5 || type === 6) && this.chatPrivateMode < 2) {
                    line++;
                    if (line >= 5) {
                        return;
                    }
                }
            }
        }
    }

    // todo: order
    private handleChatMouseInput(_mouseX: number, mouseY: number): void {
        let line: number = 0;
        for (let i: number = 0; i < 100; i++) {
            if (!this.chatText[i]) {
                continue;
            }

            const type: number = this.chatType[i];
            const y: number = this.chatScrollPos + 70 + 4 - line * 14;
            if (y < -20) {
                break;
            }

            let sender = this.chatUsername[i];
            let _mod = false;
            if (sender && sender.startsWith('@cr1@')) {
                sender = sender.substring(5);
                _mod = true;
            } else if (sender && sender.startsWith('@cr2@')) {
                sender = sender.substring(5);
                _mod = true;
            }

            if (type === 0) {
                line++;
            } else if ((type == 1 || type == 2) && (type == 1 || this.chatPublicMode == 0 || (this.chatPublicMode == 1 && this.isFriend(sender)))) {
                if (mouseY > y - 14 && mouseY <= y && this.localPlayer && sender !== this.localPlayer.name) {
                    if (this.staffmodlevel >= 1) {
                        this.menuOption[this.menuNumEntries] = 'Report abuse @whi@' + sender;
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.ABUSE_REPORT;
                        this.menuNumEntries++;
                    }

                    this.menuOption[this.menuNumEntries] = 'Add ignore @whi@' + sender;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.IGNORELIST_ADD;
                    this.menuNumEntries++;

                    this.menuOption[this.menuNumEntries] = 'Add friend @whi@' + sender;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.FRIENDLIST_ADD;
                    this.menuNumEntries++;
                }

                line++;
            } else if ((type === 3 || type === 7) && this.splitPrivateChat === 0 && (type === 7 || this.chatPrivateMode === 0 || (this.chatPrivateMode === 1 && this.isFriend(sender)))) {
                if (mouseY > y - 14 && mouseY <= y) {
                    if (this.staffmodlevel >= 1) {
                        this.menuOption[this.menuNumEntries] = 'Report abuse @whi@' + sender;
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.ABUSE_REPORT;
                        this.menuNumEntries++;
                    }

                    this.menuOption[this.menuNumEntries] = 'Add ignore @whi@' + sender;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.IGNORELIST_ADD;
                    this.menuNumEntries++;

                    this.menuOption[this.menuNumEntries] = 'Add friend @whi@' + sender;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.FRIENDLIST_ADD;
                    this.menuNumEntries++;
                }

                line++;
            } else if (type === 4 && (this.chatTradeMode === 0 || (this.chatTradeMode === 1 && this.isFriend(sender)))) {
                if (mouseY > y - 14 && mouseY <= y) {
                    this.menuOption[this.menuNumEntries] = 'Accept trade @whi@' + sender;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.ACCEPT_TRADEREQ;
                    this.menuNumEntries++;
                }

                line++;
            } else if ((type === 5 || type === 6) && this.splitPrivateChat === 0 && this.chatPrivateMode < 2) {
                line++;
            } else if (type === 8 && (this.chatTradeMode === 0 || (this.chatTradeMode === 1 && this.isFriend(sender)))) {
                if (mouseY > y - 14 && mouseY <= y) {
                    this.menuOption[this.menuNumEntries] = 'Accept duel @whi@' + sender;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.ACCEPT_DUELREQ;
                    this.menuNumEntries++;
                }

                line++;
            }
        }
    }

    handleMinimapInput(): void {
        if (this.minimapState !== 0 || this.mouseClickButton !== 1 || !this.localPlayer) {
            return;
        }

        // Java handleMinimapInput: mouseClickX - 25 - 550, mouseClickY - 5 - 4
        let x: number = this.mouseClickX - 25 - 550;
        let y: number = this.mouseClickY - 5 - 4;

        if (x < 0 || y < 0 || x >= 146 || y >= 151) {
            return;
        }

        x -= 73;
        y -= 75;

        const yaw: number = (this.orbitCameraYaw + this.macroMinimapAngle) & 0x7ff;
        let sinYaw: number = Pix3D.sinTable[yaw];
        let cosYaw: number = Pix3D.cosTable[yaw];

        sinYaw = (sinYaw * (this.macroMinimapZoom + 256)) >> 8;
        cosYaw = (cosYaw * (this.macroMinimapZoom + 256)) >> 8;

        const relX: number = (y * sinYaw + x * cosYaw) >> 11;
        const relY: number = (y * cosYaw - x * sinYaw) >> 11;

        const tileX: number = (this.localPlayer.x + relX) >> 7;
        const tileZ: number = (this.localPlayer.z - relY) >> 7;

        if (this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], tileX, tileZ, true, 0, 0, 0, 0, 0, 1)) {
            // the additional 14-bytes in MOVE_MINIMAPCLICK
            this.out.p1(x);
            this.out.p1(y);
            this.out.p2(this.orbitCameraYaw);
            this.out.p1(57);
            this.out.p1(this.macroMinimapAngle);
            this.out.p1(this.macroMinimapZoom);
            this.out.p1(89);
            this.out.p2(this.localPlayer.x);
            this.out.p2(this.localPlayer.z);
            this.out.p1(this.tryMoveNearest);
            this.out.p1(63);
        }
    }

    // todo: order
    private handleTabInput(): void {
        if (this.mouseClickButton !== 1) {
            return;
        }

        if (this.mouseClickX >= 539 && this.mouseClickX <= 573 && this.mouseClickY >= 169 && this.mouseClickY < 205 && this.sideIcon[0] != -1) {
            this.redrawSide = true;
            this.activeIcon = 0;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 569 && this.mouseClickX <= 599 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideIcon[1] != -1) {
            this.redrawSide = true;
            this.activeIcon = 1;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 597 && this.mouseClickX <= 627 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideIcon[2] != -1) {
            this.redrawSide = true;
            this.activeIcon = 2;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 625 && this.mouseClickX <= 669 && this.mouseClickY >= 168 && this.mouseClickY < 203 && this.sideIcon[3] != -1) {
            this.redrawSide = true;
            this.activeIcon = 3;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 666 && this.mouseClickX <= 696 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideIcon[4] != -1) {
            this.redrawSide = true;
            this.activeIcon = 4;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 694 && this.mouseClickX <= 724 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideIcon[5] != -1) {
            this.redrawSide = true;
            this.activeIcon = 5;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 722 && this.mouseClickX <= 756 && this.mouseClickY >= 169 && this.mouseClickY < 205 && this.sideIcon[6] != -1) {
            this.redrawSide = true;
            this.activeIcon = 6;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 540 && this.mouseClickX <= 574 && this.mouseClickY >= 466 && this.mouseClickY < 502 && this.sideIcon[7] != -1) {
            this.redrawSide = true;
            this.activeIcon = 7;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 572 && this.mouseClickX <= 602 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideIcon[8] != -1) {
            this.redrawSide = true;
            this.activeIcon = 8;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 599 && this.mouseClickX <= 629 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideIcon[9] != -1) {
            this.redrawSide = true;
            this.activeIcon = 9;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 627 && this.mouseClickX <= 671 && this.mouseClickY >= 467 && this.mouseClickY < 502 && this.sideIcon[10] != -1) {
            this.redrawSide = true;
            this.activeIcon = 10;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 669 && this.mouseClickX <= 699 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideIcon[11] != -1) {
            this.redrawSide = true;
            this.activeIcon = 11;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 696 && this.mouseClickX <= 726 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideIcon[12] != -1) {
            this.redrawSide = true;
            this.activeIcon = 12;
            this.redrawIcons = true;
        } else if (this.mouseClickX >= 724 && this.mouseClickX <= 758 && this.mouseClickY >= 466 && this.mouseClickY < 502 && this.sideIcon[13] != -1) {
            this.redrawSide = true;
            this.activeIcon = 13;
            this.redrawIcons = true;
        }
    }

    // todo: order
    private handleChatModeInput(): void {
        if (this.mouseClickButton !== 1) {
            return;
        }

        if (this.mouseClickX >= 6 && this.mouseClickX <= 106 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
            this.chatPublicMode = (this.chatPublicMode + 1) % 4;
            this.redrawChatMode = true;
            this.redrawChat = true;

            this.out.p1Enc(ClientProt.CHAT_SETMODE);
            this.out.p1(this.chatPublicMode);
            this.out.p1(this.chatPrivateMode);
            this.out.p1(this.chatTradeMode);
        } else if (this.mouseClickX >= 135 && this.mouseClickX <= 235 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
            this.chatPrivateMode = (this.chatPrivateMode + 1) % 3;
            this.redrawChatMode = true;
            this.redrawChat = true;

            this.out.p1Enc(ClientProt.CHAT_SETMODE);
            this.out.p1(this.chatPublicMode);
            this.out.p1(this.chatPrivateMode);
            this.out.p1(this.chatTradeMode);
        } else if (this.mouseClickX >= 273 && this.mouseClickX <= 373 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
            this.chatTradeMode = (this.chatTradeMode + 1) % 3;
            this.redrawChatMode = true;
            this.redrawChat = true;

            this.out.p1Enc(ClientProt.CHAT_SETMODE);
            this.out.p1(this.chatPublicMode);
            this.out.p1(this.chatPrivateMode);
            this.out.p1(this.chatTradeMode);
        } else if (this.mouseClickX >= 412 && this.mouseClickX <= 512 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
            this.closeInterfaces();

            this.reportAbuseInput = '';
            this.reportAbuseMuteOption = false;

            for (let i: number = 0; i < IfType.list.length; i++) {
                if (IfType.get(i) && IfType.get(i)!.clientCode === ClientCode.CC_REPORT_INPUT) {
                    this.reportAbuseComId = this.mainModalId = IfType.get(i)!.layerId;
                    break;
                }
            }

            if (this.isMobile) {
                MobileKeyboard.show();
            }
        }
        Client.cyclelogic6++;
        if (Client.cyclelogic6 > 161) {
            Client.cyclelogic6 = 0;
            writeCycleLogic6(this.out);
        }
    }

    private updateEntityChats(): void {
        for (let i: number = -1; i < this.playerCount; i++) {
            let index: number;
            if (i === -1) {
                index = LOCAL_PLAYER_INDEX;
            } else {
                index = this.playerIds[i];
            }

            const player: ClientPlayer | null = this.players[index];
            if (player && player.chatTimer > 0) {
                player.chatTimer--;

                if (player.chatTimer === 0) {
                    player.chatMessage = null;
                }
            }
        }

        for (let i: number = 0; i < this.npcCount; i++) {
            const index: number = this.npcIds[i];
            const npc: ClientNpc | null = this.npc[index];

            if (npc && npc.chatTimer > 0) {
                npc.chatTimer--;

                if (npc.chatTimer === 0) {
                    npc.chatMessage = null;
                }
            }
        }
    }

    // Java handleInputKey has no anticheat prologue; ANTICHEAT_CYCLELOGIC4 lives in createMinimap (field378).
    private async handleInputKey(): Promise<void> {
        while (true) {
            let key: number;
            do {
                while (true) {
                    key = this.pollKey();
                    if (key === -1) {
                        return;
                    }

                    if (this.mainModalId !== -1 && this.mainModalId === this.reportAbuseComId) {
                        if (key === 8 && this.reportAbuseInput.length > 0) {
                            this.reportAbuseInput = this.reportAbuseInput.substring(0, this.reportAbuseInput.length - 1);
                        }
                        break;
                    }

                    if (this.socialInputOpen) {
                        if (key >= 32 && key <= 122 && this.socialInput.length < 80) {
                            this.socialInput = this.socialInput + String.fromCharCode(key);
                            this.redrawChat = true;
                        }

                        if (key === 8 && this.socialInput.length > 0) {
                            this.socialInput = this.socialInput.substring(0, this.socialInput.length - 1);
                            this.redrawChat = true;
                        }

                        if (key === 13 || key === 10) {
                            this.socialInputOpen = false;
                            this.redrawChat = true;

                            let userhash: bigint;
                            if (this.socialInputType === 1) {
                                userhash = JString.toUserhash(this.socialInput);
                                this.addFriend(userhash);
                            }

                            if (this.socialInputType === 2 && this.friendCount > 0) {
                                userhash = JString.toUserhash(this.socialInput);
                                this.removeFriend(userhash);
                            }

                            if (this.socialInputType === 3 && this.socialInput.length > 0) {
                                writePrivateMessage(
                                    this.out,
                                    this.socialUserhash ?? 0n,
                                    this.socialInput
                                );
                                // Java only requires type 3 and nonempty text; keep even a zero hash wire-compatible.

                                this.socialInput = JString.toSentenceCase(this.socialInput);
                                this.socialInput = WordFilter.filter(this.socialInput);
                                this.addMessage(JString.toScreenName(JString.toRawUsername(this.socialUserhash ?? 0n)), this.socialInput, 6);

                                if (this.chatPrivateMode === 2) {
                                    this.chatPrivateMode = 1;
                                    this.redrawChatMode = true;

                                    this.out.p1Enc(ClientProt.CHAT_SETMODE);
                                    this.out.p1(this.chatPublicMode);
                                    this.out.p1(this.chatPrivateMode);
                                    this.out.p1(this.chatTradeMode);
                                }
                            }

                            if (this.socialInputType === 4 && this.ignoreCount < 100) {
                                userhash = JString.toUserhash(this.socialInput);
                                this.addIgnore(userhash);
                            }

                            if (this.socialInputType === 5 && this.ignoreCount > 0) {
                                userhash = JString.toUserhash(this.socialInput);
                                this.removeIgnore(userhash);
                            }
                        }
                    } else if (this.chatbackInputOpen === 1 || this.dialogInputOpen) {
                        // Java chatbackInputOpen == 1 (amount)
                        if (key >= 48 && key <= 57 && this.dialogInput.length < 10) {
                            this.dialogInput = this.dialogInput + String.fromCharCode(key);
                            this.redrawChat = true;
                        }

                        if (key === 8 && this.dialogInput.length > 0) {
                            this.dialogInput = this.dialogInput.substring(0, this.dialogInput.length - 1);
                            this.redrawChat = true;
                        }

                        if (key === 13 || key === 10) {
                            if (this.dialogInput.length > 0) {
                                let value: number = 0;
                                try {
                                    value = parseInt(this.dialogInput, 10);
                                } catch (_e) {
                                    // empty
                                }

                                this.out.p1Enc(ClientProt.RESUME_P_COUNTDIALOG);
                                this.out.p4(value);
                            }

                            this.chatbackInputOpen = 0;
                            this.dialogInputOpen = false;
                            this.redrawChat = true;
                        }
                    } else if (this.chatbackInputOpen === 2) {
                        // Java chatbackInputOpen == 2 (name) → RESUME_P_NAMEDIALOG
                        if (key >= 32 && key <= 122 && this.dialogInput.length < 12) {
                            this.dialogInput = this.dialogInput + String.fromCharCode(key);
                            this.redrawChat = true;
                        }

                        if (key === 8 && this.dialogInput.length > 0) {
                            this.dialogInput = this.dialogInput.substring(0, this.dialogInput.length - 1);
                            this.redrawChat = true;
                        }

                        if (key === 13 || key === 10) {
                            if (this.dialogInput.length > 0) {
                                this.out.p1Enc(ClientProt.RESUME_P_NAMEDIALOG);
                                this.out.p8(JString.toUserhash(this.dialogInput));
                            }

                            this.chatbackInputOpen = 0;
                            this.dialogInputOpen = false;
                            this.redrawChat = true;
                        }
                    } else if (this.chatbackInputOpen === 3) {
                        // Java chatbackInputOpen == 3 (obj search) — type only, no submit
                        if (key >= 32 && key <= 122 && this.dialogInput.length < 40) {
                            this.dialogInput = this.dialogInput + String.fromCharCode(key);
                            this.redrawChat = true;
                        }

                        if (key === 8 && this.dialogInput.length > 0) {
                            this.dialogInput = this.dialogInput.substring(0, this.dialogInput.length - 1);
                            this.redrawChat = true;
                        }
                    } else if (this.chatModalId === -1 && this.fullscreenInterfaceId0 === -1) {
                        // Java: chatInterfaceId == -1 && fullscreenInterfaceId0 == -1
                        // Sticky (tutComId) does not block free chat typing (same as 377).
                        // custom: when typing a command, you can use the debugproc character (tilde)
                        if (key >= 32 && (key <= 122 || (this.chatInput.startsWith('::') && key <= 126)) && this.chatInput.length < 80) {
                            this.chatInput = this.chatInput + String.fromCharCode(key);
                            this.redrawChat = true;
                        }

                        if (key === 8 && this.chatInput.length > 0) {
                            this.chatInput = this.chatInput.substring(0, this.chatInput.length - 1);
                            this.redrawChat = true;
                        }

                        if ((key === 13 || key === 10) && this.chatInput.length > 0) {
                            if (this.staffmodlevel === 2) {
                                if (this.chatInput === '::clientdrop') {
                                    await this.tryReconnect();
                                } else if (this.chatInput === '::prefetchmusic') {
                                    if (this.onDemand) {
                                        for (let i = 0; i < this.onDemand.getFileCount(2); i++) {
                                            await this.onDemand.prefetchPriority(2, i, 1);
                                        }
                                    }
                                } else if (this.chatInput === '::lag') {
                                    this.lag();
                                }
                            }

                            // custom: player-facing commands
                            if (this.chatInput === '::fpson') {
                                // authentic in later revs
                                this.showFps = true;
                            } else if (this.chatInput === '::fpsoff') {
                                // authentic in later revs
                                this.showFps = false;
                            } else if (this.chatInput.startsWith('::fps ')) {
                                // authentic in later revs
                                try {
                                    const desiredFps = parseInt(this.chatInput.substring(6)) || 50;
                                    this.setTargetedFramerate(desiredFps);
                                } catch (_e) {
                                    // empty
                                }
                            } else if (this.chatInput.startsWith('::')) {
                                this.out.p1Enc(ClientProt.CLIENT_CHEAT);
                                this.out.p1(this.chatInput.length - 2 + 1);
                                this.out.pjstr(this.chatInput.substring(2));
                            } else {
                                const { message, colour, effect } = writePublicChat(this.out, this.chatInput);
                                this.chatInput = message;
                                this.chatInput = JString.toSentenceCase(this.chatInput);
                                this.chatInput = WordFilter.filter(this.chatInput);

                                if (this.localPlayer && this.localPlayer.name) {
                                    this.localPlayer.chatMessage = this.chatInput;
                                    this.localPlayer.chatColour = colour;
                                    this.localPlayer.chatEffect = effect;
                                    this.localPlayer.chatTimer = 150;

                                    if (this.staffmodlevel === 2) {
                                        this.addMessage('@cr2@' + this.localPlayer.name, this.localPlayer.chatMessage, 2);
                                    } else if (this.staffmodlevel === 1) {
                                        this.addMessage('@cr1@' + this.localPlayer.name, this.localPlayer.chatMessage, 2);
                                    } else {
                                        this.addMessage(this.localPlayer.name, this.localPlayer.chatMessage, 2);
                                    }
                                }

                                if (this.chatPublicMode === 2) {
                                    this.chatPublicMode = 3;
                                    this.redrawChatMode = true;

                                    this.out.p1Enc(ClientProt.CHAT_SETMODE);
                                    this.out.p1(this.chatPublicMode);
                                    this.out.p1(this.chatPrivateMode);
                                    this.out.p1(this.chatTradeMode);
                                }
                            }

                            this.chatInput = '';
                            this.redrawChat = true;
                        }
                    }
                }
            } while ((key < 97 || key > 122) && (key < 65 || key > 90) && (key < 48 || key > 57) && key !== 32);

            if (this.reportAbuseInput.length < 12) {
                this.reportAbuseInput = this.reportAbuseInput + String.fromCharCode(key);
            }
        }
    }

    // todo: order — Java lag() labels (Od-cycle capital O)
    private lag() {
        console.log('============');
        console.log(`flame-cycle:${this.titleFlames?.coolingCycle ?? 0}`);
        if (this.onDemand) {
            console.log(`Od-cycle:${this.onDemand.cycle}`);
        }
        console.log(`loop-cycle:${Client.loopCycle}`);
        console.log(`draw-cycle:${Client.drawCycle}`);
        console.log(`ptype:${this.ptype}`);
        console.log(`psize:${this.psize}`);
        // this.stream?.debug();
        this.debug = true;
    }

    private updateOrbitCamera(): void {
        if (!this.localPlayer) {
            return; // custom
        }

        const orbitX: number = this.localPlayer.x + this.macroCameraX;
        const orbitZ: number = this.localPlayer.z + this.macroCameraZ;

        if (this.orbitCameraX - orbitX < -500 || this.orbitCameraX - orbitX > 500 || this.orbitCameraZ - orbitZ < -500 || this.orbitCameraZ - orbitZ > 500) {
            this.orbitCameraX = orbitX;
            this.orbitCameraZ = orbitZ;
        }

        if (this.orbitCameraX !== orbitX) {
            this.orbitCameraX += ((orbitX - this.orbitCameraX) / 16) | 0;
        }

        if (this.orbitCameraZ !== orbitZ) {
            this.orbitCameraZ += ((orbitZ - this.orbitCameraZ) / 16) | 0;
        }

        if (this.keyHeld[1] === 1) {
            this.orbitCameraYawVelocity += ((-this.orbitCameraYawVelocity - 24) / 2) | 0;
        } else if (this.keyHeld[2] === 1) {
            this.orbitCameraYawVelocity += ((24 - this.orbitCameraYawVelocity) / 2) | 0;
        } else {
            this.orbitCameraYawVelocity = (this.orbitCameraYawVelocity / 2) | 0;
        }

        if (this.keyHeld[3] === 1) {
            this.orbitCameraPitchVelocity += ((12 - this.orbitCameraPitchVelocity) / 2) | 0;
        } else if (this.keyHeld[4] === 1) {
            this.orbitCameraPitchVelocity += ((-this.orbitCameraPitchVelocity - 12) / 2) | 0;
        } else {
            this.orbitCameraPitchVelocity = (this.orbitCameraPitchVelocity / 2) | 0;
        }

        this.orbitCameraYaw = ((this.orbitCameraYaw + this.orbitCameraYawVelocity / 2) | 0) & 0x7ff;
        this.orbitCameraPitch += (this.orbitCameraPitchVelocity / 2) | 0;

        if (this.orbitCameraPitch < 128) {
            this.orbitCameraPitch = 128;
        } else if (this.orbitCameraPitch > 383) {
            this.orbitCameraPitch = 383;
        }

        const orbitTileX: number = this.orbitCameraX >> 7;
        const orbitTileZ: number = this.orbitCameraZ >> 7;
        const orbitY: number = this.getHeightmapY(this.orbitCameraX, this.orbitCameraZ, this.minusedlevel);
        let maxY: number = 0;

        if (this.groundh) {
            if (orbitTileX > 3 && orbitTileZ > 3 && orbitTileX < 100 && orbitTileZ < 100) {
                for (let x: number = orbitTileX - 4; x <= orbitTileX + 4; x++) {
                    for (let z: number = orbitTileZ - 4; z <= orbitTileZ + 4; z++) {
                        let level: number = this.minusedlevel;
                        // Java updateOrbitCamera: (levelTileFlags[1][x][z] & 0x2) == 2 → LinkBelow
                        if (level < 3 && this.mapl && (this.mapl[1][x][z] & MapFlag.LinkBelow) !== 0) {
                            level++;
                        }

                        const y: number = orbitY - this.groundh[level][x][z];
                        if (y > maxY) {
                            maxY = y;
                        }
                    }
                }
            }
        }

        let clamp: number = maxY * 192;
        if (clamp > 98048) {
            clamp = 98048;
        } else if (clamp < 32768) {
            clamp = 32768;
        }

        if (clamp > this.cameraPitchClamp) {
            this.cameraPitchClamp += ((clamp - this.cameraPitchClamp) / 24) | 0;
        } else if (clamp < this.cameraPitchClamp) {
            this.cameraPitchClamp += ((clamp - this.cameraPitchClamp) / 80) | 0;
        }
    }

    private applyCutscene(): void {
        let x: number = this.camMoveToLx * 128 + 64;
        let z: number = this.camMoveToLz * 128 + 64;
        let y: number = this.getHeightmapY(x, z, this.minusedlevel) - this.camMoveToHei;

        if (this.camX < x) {
            this.camX += this.camMoveToRate + ((((x - this.camX) * this.camMoveToRate2) / 1000) | 0);
            if (this.camX > x) {
                this.camX = x;
            }
        }

        if (this.camX > x) {
            this.camX -= this.camMoveToRate + ((((this.camX - x) * this.camMoveToRate2) / 1000) | 0);
            if (this.camX < x) {
                this.camX = x;
            }
        }

        if (this.camY < y) {
            this.camY += this.camMoveToRate + ((((y - this.camY) * this.camMoveToRate2) / 1000) | 0);
            if (this.camY > y) {
                this.camY = y;
            }
        }

        if (this.camY > y) {
            this.camY -= this.camMoveToRate + ((((this.camY - y) * this.camMoveToRate2) / 1000) | 0);
            if (this.camY < y) {
                this.camY = y;
            }
        }

        if (this.camZ < z) {
            this.camZ += this.camMoveToRate + ((((z - this.camZ) * this.camMoveToRate2) / 1000) | 0);
            if (this.camZ > z) {
                this.camZ = z;
            }
        }

        if (this.camZ > z) {
            this.camZ -= this.camMoveToRate + ((((this.camZ - z) * this.camMoveToRate2) / 1000) | 0);
            if (this.camZ < z) {
                this.camZ = z;
            }
        }

        x = this.camLookAtLx * 128 + 64;
        z = this.camLookAtLz * 128 + 64;
        y = this.getHeightmapY(x, z, this.minusedlevel) - this.camLookAtHei;

        const dx: number = x - this.camX;
        const dy: number = y - this.camY;
        const dz: number = z - this.camZ;

        const distance: number = Math.sqrt(dx * dx + dz * dz) | 0;
        let pitch: number = ((Math.atan2(dy, distance) * 325.949) | 0) & 0x7ff;
        const yaw: number = ((Math.atan2(dx, dz) * -325.949) | 0) & 0x7ff;

        if (pitch < 128) {
            pitch = 128;
        } else if (pitch > 383) {
            pitch = 383;
        }

        if (this.camPitch < pitch) {
            this.camPitch += this.camLookAtRate + ((((pitch - this.camPitch) * this.camLookAtRate2) / 1000) | 0);
            if (this.camPitch > pitch) {
                this.camPitch = pitch;
            }
        }

        if (this.camPitch > pitch) {
            this.camPitch -= this.camLookAtRate + ((((this.camPitch - pitch) * this.camLookAtRate2) / 1000) | 0);
            if (this.camPitch < pitch) {
                this.camPitch = pitch;
            }
        }

        let deltaYaw: number = yaw - this.camYaw;
        if (deltaYaw > 1024) {
            deltaYaw -= 2048;
        } else if (deltaYaw < -1024) {
            deltaYaw += 2048;
        }

        if (deltaYaw > 0) {
            this.camYaw += this.camLookAtRate + (((deltaYaw * this.camLookAtRate2) / 1000) | 0);
            this.camYaw &= 0x7ff;
        }

        if (deltaYaw < 0) {
            this.camYaw -= this.camLookAtRate + (((-deltaYaw * this.camLookAtRate2) / 1000) | 0);
            this.camYaw &= 0x7ff;
        }

        let tmp: number = yaw - this.camYaw;
        if (tmp > 1024) {
            tmp -= 2048;
        } else if (tmp < -1024) {
            tmp += 2048;
        }

        if ((tmp < 0 && deltaYaw > 0) || (tmp > 0 && deltaYaw < 0)) {
            this.camYaw = yaw;
        }
    }

    /**
     * Java `Client.updateAudio` — drain SFX queue + MIDI jingle timer.
     * Replay same id/loops; busy play → delay=-5 retry; else dequeue.
     */
    async updateAudio() {
        for (let wave: number = 0; wave < this.waveCount; wave++) {
            if (this.waveDelay[wave] <= 0) {
                let failed = false;
                try {
                    if (this.waveIds[wave] !== this.lastWaveId || this.waveLoops[wave] !== this.lastWaveLoops) {
                        // Java Wave.method479(loops, 6, id)
                        const buf: Packet | null = JagFX.generate(this.waveIds[wave], this.waveLoops[wave]);
                        if (!buf) {
                            throw new Error();
                        }

                        // Overlap gate: only start if prior wave would have finished
                        if (performance.now() + ((buf.pos / 22) | 0) > this.lastWaveStartTime + ((this.lastWaveLength / 22) | 0)) {
                            this.lastWaveLength = buf.pos;
                            this.lastWaveStartTime = performance.now();
                            // Java saveWave — false when signlink busy
                            if (await playWave(buf.data.slice(0, buf.pos))) {
                                this.lastWaveId = this.waveIds[wave];
                                this.lastWaveLoops = this.waveLoops[wave];
                            } else {
                                failed = true;
                            }
                        }
                        // if gate fails: drop (failed stays false) — same as Java
                    } else if (!(await replayWave())) {
                        // Java replayWave / wavereplay
                        failed = true;
                    }
                } catch {
                    writeSynthError(this.out, this.waveIds[wave], Client.reportErrors);
                }

                if (failed && this.waveDelay[wave] !== -5) {
                    // Java: retry next frames
                    this.waveDelay[wave] = -5;
                } else {
                    this.waveCount--;
                    for (let i: number = wave; i < this.waveCount; i++) {
                        this.waveIds[i] = this.waveIds[i + 1];
                        this.waveLoops[i] = this.waveLoops[i + 1];
                        this.waveDelay[i] = this.waveDelay[i + 1];
                    }
                    wave--;
                }
            } else {
                this.waveDelay[wave]--;
            }
        }

        // Java updateAudio: one client cycle = GameShell.deltime 20ms.
        // nextMusicDelay is milliseconds (MIDI_JINGLE 3-byte). Do not call this
        // faster than 20ms or jingles cut short. At 0, re-request nextMidiSong
        // (last MIDI_SONG / zone) with fade — era: complete jingle then region.
        if (this.nextMusicDelay > 0) {
            this.nextMusicDelay -= 20;

            if (this.nextMusicDelay < 0) {
                this.nextMusicDelay = 0;
            }

            if (this.nextMusicDelay === 0 && this.midiActive && !Client.lowMem) {
                this.midiSong = this.nextMidiSong;
                this.midiFading = true;
                this.onDemand?.request(2, this.midiSong);
            }
        }
    }

    private updatePlayers(): void {
        for (let i: number = -1; i < this.playerCount; i++) {
            let index: number;
            if (i === -1) {
                index = LOCAL_PLAYER_INDEX;
            } else {
                index = this.playerIds[i];
            }

            const player: ClientPlayer | null = this.players[index];
            if (player) {
                this.updateEntity(player);
            }
        }
    }

    private updateNpcs(): void {
        for (let i: number = 0; i < this.npcCount; i++) {
            const id: number = this.npcIds[i];
            const npc: ClientNpc | null = this.npc[id];

            if (npc && npc.type) {
                this.updateEntity(npc);
            }
        }
    }

    private updateEntity(e: ClientEntity): void {
        if (e.x < 128 || e.z < 128 || e.x >= 13184 || e.z >= 13184) {
            e.primaryAnim = -1;
            e.spotanimId = -1;
            e.exactMoveEnd = 0;
            e.exactMoveStart = 0;
            e.x = e.routeX[0] * 128 + e.size * 64;
            e.z = e.routeZ[0] * 128 + e.size * 64;
            e.abortRoute();
        }

        if (e === this.localPlayer && (e.x < 1536 || e.z < 1536 || e.x >= 11776 || e.z >= 11776)) {
            e.primaryAnim = -1;
            e.spotanimId = -1;
            e.exactMoveEnd = 0;
            e.exactMoveStart = 0;
            e.x = e.routeX[0] * 128 + e.size * 64;
            e.z = e.routeZ[0] * 128 + e.size * 64;
            e.abortRoute();
        }

        if (e.exactMoveEnd > Client.loopCycle) {
            this.startForceMovement(e);
        } else if (e.exactMoveStart >= Client.loopCycle) {
            this.updateForceMovement(e);
        } else {
            this.updateMovement(e);
        }

        this.updateFacingDirection(e);
        this.updateSequences(e);
    }

    private startForceMovement(e: ClientEntity): void {
        const delta: number = e.exactMoveEnd - Client.loopCycle;
        const dstX: number = e.exactStartX * 128 + e.size * 64;
        const dstZ: number = e.exactStartZ * 128 + e.size * 64;

        e.x += ((dstX - e.x) / delta) | 0;
        e.z += ((dstZ - e.z) / delta) | 0;

        e.animDelayMove = 0;

        if (e.exactMoveFacing === 0) {
            e.dstYaw = 1024;
        } else if (e.exactMoveFacing === 1) {
            e.dstYaw = 1536;
        } else if (e.exactMoveFacing === 2) {
            e.dstYaw = 0;
        } else if (e.exactMoveFacing === 3) {
            e.dstYaw = 512;
        }
    }

    private updateForceMovement(e: ClientEntity): void {
        if (e.exactMoveStart === Client.loopCycle || e.primaryAnim === -1 || e.primaryAnimDelay !== 0 || e.primaryAnimCycle + 1 > SeqType.list[e.primaryAnim].getDelay(e.primaryAnimFrame)) {
            const duration: number = e.exactMoveStart - e.exactMoveEnd;
            const delta: number = Client.loopCycle - e.exactMoveEnd;
            const dx0: number = e.exactStartX * 128 + e.size * 64;
            const dz0: number = e.exactStartZ * 128 + e.size * 64;
            const dx1: number = e.exactEndX * 128 + e.size * 64;
            const dz1: number = e.exactEndZ * 128 + e.size * 64;
            e.x = ((dx0 * (duration - delta) + dx1 * delta) / duration) | 0;
            e.z = ((dz0 * (duration - delta) + dz1 * delta) / duration) | 0;
        }

        e.animDelayMove = 0;

        if (e.exactMoveFacing === 0) {
            e.dstYaw = 1024;
        } else if (e.exactMoveFacing === 1) {
            e.dstYaw = 1536;
        } else if (e.exactMoveFacing === 2) {
            e.dstYaw = 0;
        } else if (e.exactMoveFacing === 3) {
            e.dstYaw = 512;
        }

        e.yaw = e.dstYaw;
    }

    private updateMovement(e: ClientEntity): void {
        e.secondaryAnim = e.readyanim;

        if (e.routeLength === 0) {
            e.animDelayMove = 0;
            return;
        }

        if (e.primaryAnim !== -1 && e.primaryAnimDelay === 0) {
            const seq: SeqType = SeqType.list[e.primaryAnim];
            if (e.preanimRouteLength > 0 && seq.preanim_move === PreanimMove.DELAYMOVE) {
                e.animDelayMove++;
                return;
            }

            if (e.preanimRouteLength <= 0 && seq.postanim_move === PostanimMove.DELAYMOVE) {
                e.animDelayMove++;
                return;
            }
        }

        const x: number = e.x;
        const z: number = e.z;
        const dstX: number = e.routeX[e.routeLength - 1] * 128 + e.size * 64;
        const dstZ: number = e.routeZ[e.routeLength - 1] * 128 + e.size * 64;

        if (dstX - x > 256 || dstX - x < -256 || dstZ - z > 256 || dstZ - z < -256) {
            e.x = dstX;
            e.z = dstZ;
            return;
        }

        if (x < dstX) {
            if (z < dstZ) {
                e.dstYaw = 1280;
            } else if (z > dstZ) {
                e.dstYaw = 1792;
            } else {
                e.dstYaw = 1536;
            }
        } else if (x > dstX) {
            if (z < dstZ) {
                e.dstYaw = 768;
            } else if (z > dstZ) {
                e.dstYaw = 256;
            } else {
                e.dstYaw = 512;
            }
        } else if (z < dstZ) {
            e.dstYaw = 1024;
        } else {
            e.dstYaw = 0;
        }

        let deltaYaw: number = (e.dstYaw - e.yaw) & 0x7ff;
        if (deltaYaw > 1024) {
            deltaYaw -= 2048;
        }

        let seqId: number = e.walkanim_b;
        if (deltaYaw >= -256 && deltaYaw <= 256) {
            seqId = e.walkanim;
        } else if (deltaYaw >= 256 && deltaYaw < 768) {
            seqId = e.walkanim_r;
        } else if (deltaYaw >= -768 && deltaYaw <= -256) {
            seqId = e.walkanim_l;
        }

        if (seqId === -1) {
            seqId = e.walkanim;
        }

        e.secondaryAnim = seqId;

        let moveSpeed: number = 4;
        if (e.yaw !== e.dstYaw && e.faceEntity === -1 && e.turnspeed !== 0) {
            moveSpeed = 2;
        }
        if (e.routeLength > 2) {
            moveSpeed = 6;
        }
        if (e.routeLength > 3) {
            moveSpeed = 8;
        }
        if (e.animDelayMove > 0 && e.routeLength > 1) {
            moveSpeed = 8;
            e.animDelayMove--;
        }
        if (e.routeRun[e.routeLength - 1]) {
            moveSpeed <<= 0x1;
        }

        if (moveSpeed >= 8 && e.secondaryAnim === e.walkanim && e.runanim !== -1) {
            e.secondaryAnim = e.runanim;
        }

        if (x < dstX) {
            e.x += moveSpeed;
            if (e.x > dstX) {
                e.x = dstX;
            }
        } else if (x > dstX) {
            e.x -= moveSpeed;
            if (e.x < dstX) {
                e.x = dstX;
            }
        }
        if (z < dstZ) {
            e.z += moveSpeed;
            if (e.z > dstZ) {
                e.z = dstZ;
            }
        } else if (z > dstZ) {
            e.z -= moveSpeed;
            if (e.z < dstZ) {
                e.z = dstZ;
            }
        }

        if (e.x === dstX && e.z === dstZ) {
            e.routeLength--;
            if (e.preanimRouteLength > 0) {
                e.preanimRouteLength--;
            }
        }
    }

    private updateFacingDirection(e: ClientEntity): void {
        if (e.turnspeed === 0) {
            return;
        }

        if (e.faceEntity !== -1 && e.faceEntity < 32768) {
            const npc: ClientNpc | null = this.npc[e.faceEntity];
            if (npc) {
                const dstX: number = e.x - npc.x;
                const dstZ: number = e.z - npc.z;

                if (dstX !== 0 || dstZ !== 0) {
                    e.dstYaw = ((Math.atan2(dstX, dstZ) * 325.949) | 0) & 0x7ff;
                }
            }
        }

        if (e.faceEntity >= 32768) {
            let index: number = e.faceEntity - 32768;
            if (index === this.selfSlot) {
                index = LOCAL_PLAYER_INDEX;
            }

            const player: ClientPlayer | null = this.players[index];
            if (player) {
                const dstX: number = e.x - player.x;
                const dstZ: number = e.z - player.z;

                if (dstX !== 0 || dstZ !== 0) {
                    e.dstYaw = ((Math.atan2(dstX, dstZ) * 325.949) | 0) & 0x7ff;
                }
            }
        }

        if ((e.faceSquareX !== 0 || e.faceSquareZ !== 0) && (e.routeLength === 0 || e.animDelayMove > 0)) {
            const dstX: number = e.x - (e.faceSquareX - this.mapBuildBaseX - this.mapBuildBaseX) * 64;
            const dstZ: number = e.z - (e.faceSquareZ - this.mapBuildBaseZ - this.mapBuildBaseZ) * 64;

            if (dstX !== 0 || dstZ !== 0) {
                e.dstYaw = ((Math.atan2(dstX, dstZ) * 325.949) | 0) & 0x7ff;
            }

            e.faceSquareX = 0;
            e.faceSquareZ = 0;
        }

        const remainingYaw: number = (e.dstYaw - e.yaw) & 0x7ff;
        if (remainingYaw !== 0) {
            if (remainingYaw < e.turnspeed || remainingYaw > 2048 - e.turnspeed) {
                e.yaw = e.dstYaw;
            } else if (remainingYaw > 1024) {
                e.yaw -= e.turnspeed;
            } else {
                e.yaw += e.turnspeed;
            }

            e.yaw &= 0x7ff;

            if (e.secondaryAnim === e.readyanim && e.yaw !== e.dstYaw) {
                if (e.turnanim != -1) {
                    e.secondaryAnim = e.turnanim;
                } else {
                    e.secondaryAnim = e.walkanim;
                }
            }
        }
    }

    /**
     * Java 377 `updateSequences` — secondary/spot/primary advance one frame per tick with cycle reset to 1
     * (289 used while-loops + cycle=0; TS was still on 289 timing).
     */
    private updateSequences(e: ClientEntity): void {
        e.needsForwardDrawPadding = false;

        let seq: SeqType | null;
        if (e.secondaryAnim !== -1) {
            seq = SeqType.list[e.secondaryAnim];
            e.secondaryAnimCycle++;

            if (e.secondaryAnimFrame < seq.numFrames && e.secondaryAnimCycle > seq.getDelay(e.secondaryAnimFrame)) {
                e.secondaryAnimCycle = 1;
                e.secondaryAnimFrame++;
            }

            if (e.secondaryAnimFrame >= seq.numFrames) {
                e.secondaryAnimCycle = 1;
                e.secondaryAnimFrame = 0;
            }
        }

        if (e.spotanimId !== -1 && Client.loopCycle >= e.spotanimLastCycle) {
            if (e.spotanimFrame < 0) {
                e.spotanimFrame = 0;
            }

            seq = SpotType.list[e.spotanimId].seq;
            e.spotanimCycle++;

            // Java 377: single-step if, cycle = 1 (not while + subtract delay)
            if (seq && e.spotanimFrame < seq.numFrames && e.spotanimCycle > seq.getDelay(e.spotanimFrame)) {
                e.spotanimCycle = 1;
                e.spotanimFrame++;
            }

            if (seq && e.spotanimFrame >= seq.numFrames && (e.spotanimFrame < 0 || e.spotanimFrame >= seq.numFrames)) {
                e.spotanimId = -1;
            }
        }

        // Java: field1153 (exactMoveEnd) <= loop && field1154 (exactMoveStart) < loop — after exact-move done
        if (e.primaryAnim != -1 && e.primaryAnimDelay <= 1) {
            seq = SeqType.list[e.primaryAnim];
            if (
                seq.preanim_move === PreanimMove.DELAYANIM &&
                e.preanimRouteLength > 0 &&
                e.exactMoveEnd <= Client.loopCycle &&
                e.exactMoveStart < Client.loopCycle
            ) {
                e.primaryAnimDelay = 1;
                return;
            }
        }

        if (e.primaryAnim !== -1 && e.primaryAnimDelay === 0) {
            seq = SeqType.list[e.primaryAnim];
            e.primaryAnimCycle++;

            if (e.primaryAnimFrame < seq.numFrames && e.primaryAnimCycle > seq.getDelay(e.primaryAnimFrame)) {
                e.primaryAnimCycle = 1;
                e.primaryAnimFrame++;
            }

            if (e.primaryAnimFrame >= seq.numFrames) {
                e.primaryAnimFrame -= seq.loops;
                e.primaryAnimLoop++;

                if (e.primaryAnimLoop >= seq.maxloops) {
                    e.primaryAnim = -1;
                }

                if (e.primaryAnimFrame < 0 || e.primaryAnimFrame >= seq.numFrames) {
                    e.primaryAnim = -1;
                }
            }

            e.needsForwardDrawPadding = seq.reachforward;
        }

        if (e.primaryAnimDelay > 0) {
            e.primaryAnimDelay--;
        }
    }

    override async drawProgress(message: string, progress: number): Promise<void> {
        console.log(`${progress}%: ${message}`);

        this.lastProgressPercent = progress;
        this.lastProgressMessage = message;

        await this.loadTitle();

        if (!this.title) {
            await super.drawProgress(message, progress);
            return;
        }

        this.imageTitle4?.setPixels();

        const x: number = 360;
        const y: number = 200;

        const offsetY: number = 20;
        this.b12?.centreString('RuneScape is loading - please wait...', (x / 2) | 0, ((y / 2) | 0) - offsetY - 26, Colour.WHITE);

        const midY: number = ((y / 2) | 0) - 18 - offsetY;
        Pix2D.drawRect(((x / 2) | 0) - 152, midY, 304, 34, 0x8c1111);
        Pix2D.drawRect(((x / 2) | 0) - 151, midY + 1, 302, 32, Colour.BLACK);
        Pix2D.fillRect(((x / 2) | 0) - 150, midY + 2, progress * 3, 30, 0x8c1111);
        Pix2D.fillRect(((x / 2) | 0) - 150 + progress * 3, midY + 2, 300 - progress * 3, 30, Colour.BLACK);
        this.b12?.centreString(message, (x / 2) | 0, ((y / 2) | 0) + 5 - offsetY, Colour.WHITE);

        this.imageTitle4?.draw(202, 171);

        if (this.redrawFrame) {
            this.redrawFrame = false;

            if (!this.titleFlames?.active) {
                this.imageTitle0?.draw(0, 0);
                this.imageTitle1?.draw(637, 0);
            }

            this.imageTitle2?.draw(128, 0);
            this.imageTitle3?.draw(202, 371);
            this.imageTitle5?.draw(0, 265);
            this.imageTitle6?.draw(562, 265);
            this.imageTitle7?.draw(128, 171);
            this.imageTitle8?.draw(562, 171);
        }

        await sleep(5); // return a slice of time to the main loop so it can update the progress bar
    }

    /**
     * Port of Client-Java `drawGame` (full frame: fullscreen IF / scene / sidebar / chat / minimap).
     * Java always calls prepareGame() inside redrawFrame before blitting chrome.
     * Java PixMap.draw(y, x, g) — TS PixMap.draw(x, y).
     */
    private drawGame(): void {
        if (this.players === null) {
            // client is unloading asynchronously
            return;
        }

        // Java: fullscreenInterfaceId0 takes the entire 765×503 surface
        if (this.fullscreenInterfaceId0 !== -1 && (this.sceneState === 2 || this.drawArea !== null)) {
            if (this.sceneState === 2) {
                this.updateInterfaceAnimation(this.fullscreenInterfaceId0, this.worldUpdateNum);
                if (this.fullscreenInterfaceId1 !== -1) {
                    this.updateInterfaceAnimation(this.fullscreenInterfaceId1, this.worldUpdateNum);
                }

                this.prepareFullGame();
                this.drawArea?.setPixels();
                if (this.fullscreenScanline) {
                    Pix3D.scanline = this.fullscreenScanline;
                }
                Pix2D.cls();
                this.redrawFrame = true;

                let fs0 = IfType.get(this.fullscreenInterfaceId0);
                if (fs0) {
                    if (fs0.width === 512 && fs0.height === 334 && fs0.type === ComponentType.TYPE_LAYER) {
                        fs0.width = 765;
                        fs0.height = 503;
                    }
                    this.drawInterface(fs0, 0, 0, 0);
                }
                if (this.fullscreenInterfaceId1 !== -1) {
                    let fs1 = IfType.get(this.fullscreenInterfaceId1);
                    if (fs1) {
                        if (fs1.width === 512 && fs1.height === 334 && fs1.type === ComponentType.TYPE_LAYER) {
                            fs1.width = 765;
                            fs1.height = 503;
                        }
                        this.drawInterface(fs1, 0, 0, 0);
                    }
                }

                if (this.isMenuOpen) {
                    this.drawMenu();
                } else {
                    this.handleInput();
                    this.showPopupMessage();
                }
            }
            this.drawArea?.draw(0, 0);
            return;
        }

        if (this.redrawFrame) {
            this.prepareGame();
            this.redrawFrame = false;

            // Java: draw(y, x) → TS draw(x, y)
            this.areaBackleft1?.draw(0, 4);
            this.areaBackleft2?.draw(0, 357);
            this.areaBackright1?.draw(722, 4);
            this.areaBackright2?.draw(743, 205);
            this.areaBacktop1?.draw(0, 0);
            this.areaBackvmid1?.draw(516, 4);
            this.areaBackvmid2?.draw(516, 205);
            this.areaBackvmid3?.draw(496, 357);
            this.areaBackhmid2?.draw(0, 338);

            this.redrawSide = true;
            this.redrawChat = true;
            this.redrawIcons = true;
            this.redrawChatMode = true;

            if (this.sceneState !== 2) {
                this.areaGame?.draw(4, 4);
                this.areaMap?.draw(550, 4);
            }

            // Java field533++ > 85 → ANTICHEAT_CYCLELOGIC2 (opcode 168, length 0)
            Client.cyclelogic2++;
            if (Client.cyclelogic2 > 85) {
                Client.cyclelogic2 = 0;
                this.out.p1Enc(ClientProt.ANTICHEAT_CYCLELOGIC2);
            }
        }

        if (this.sceneState === 2) {
            this.drawScene();
        }

        if (this.isMenuOpen && this.menuArea === 1) {
            this.redrawSide = true;
        }

        if (this.sideModalId !== -1) {
            const redraw = this.updateInterfaceAnimation(this.sideModalId, this.worldUpdateNum);
            if (redraw) {
                this.redrawSide = true;
            }
        }

        if (this.selectedArea === 2) {
            this.redrawSide = true;
        }

        if (this.objDragArea === 2) {
            this.redrawSide = true;
        }

        if (this.redrawSide) {
            this.drawSidebar();
            this.redrawSide = false;
        }

        // Java: chatInterfaceId == -1 && chatbackInputOpen == 0
        if (this.chatModalId === -1 && this.chatbackInputOpen === 0) {
            this.chatInterface.scrollPos = this.chatScrollHeight - this.chatScrollPos - 77;

            if (this.mouseX > 448 && this.mouseX < 560 && this.mouseY > 332) {
                this.handleScrollInput(this.mouseX - 17, this.mouseY - 357, this.chatScrollHeight, 77, false, 463, 0, this.chatInterface);
            }

            let offset: number = this.chatScrollHeight - this.chatInterface.scrollPos - 77;
            if (offset < 0) {
                offset = 0;
            }

            if (offset > this.chatScrollHeight - 77) {
                offset = this.chatScrollHeight - 77;
            }

            if (this.chatScrollPos !== offset) {
                this.chatScrollPos = offset;
                this.redrawChat = true;
            }
        }

        // Java: chatInterfaceId == -1 && chatbackInputOpen == 3 (obj-search results scroll)
        if (this.chatModalId === -1 && this.chatbackInputOpen === 3) {
            const resultHeight = this.objSearchResultCount * 14 + 7;
            this.chatInterface.scrollPos = this.objSearchScrollPos;

            if (this.mouseX > 448 && this.mouseX < 560 && this.mouseY > 332) {
                this.handleScrollInput(this.mouseX - 17, this.mouseY - 357, resultHeight, 77, false, 463, 0, this.chatInterface);
            }

            let offset: number = this.chatInterface.scrollPos;
            if (offset < 0) {
                offset = 0;
            }
            if (offset > resultHeight - 77) {
                offset = resultHeight - 77;
            }
            if (this.objSearchScrollPos !== offset) {
                this.objSearchScrollPos = offset;
                this.redrawChat = true;
            }
        }

        if (this.chatModalId !== -1) {
            const redraw = this.updateInterfaceAnimation(this.chatModalId, this.worldUpdateNum);
            if (redraw) {
                this.redrawChat = true;
            }
        }

        if (this.selectedArea === 3) {
            this.redrawChat = true;
        }

        if (this.objDragArea === 3) {
            this.redrawChat = true;
        }

        if (this.tutComMessage) {
            this.redrawChat = true;
        }

        if (this.isMenuOpen && this.menuArea === 2) {
            this.redrawChat = true;
        }

        if (this.redrawChat) {
            this.drawChat();
            this.redrawChat = false;
        }

        if (this.sceneState === 2) {
            this.drawMinimap();
            this.areaMap?.draw(550, 4);
        }

        if (this.tutFlashIcon !== -1) {
            this.redrawIcons = true;
        }

        if (this.redrawIcons) {
            if (this.tutFlashIcon !== -1 && this.tutFlashIcon === this.activeIcon) {
                this.tutFlashIcon = -1;
                this.out.p1Enc(ClientProt.TUT_CLICKSIDE);
                this.out.p1(this.activeIcon);
            }

            this.redrawIcons = false;
            this.areaBackhmid1?.setPixels();
            this.backhmid1?.plotSprite(0, 0);

            // Java plotSprite(y, x) → TS plotSprite(x, y). Values from Client-Java 377 drawScene redstone block.
            if (this.sideModalId === -1) {
                if (this.sideIcon[this.activeIcon] !== -1) {
                    // Java: redstone1(10,22) redstone2(8,54/82) redstone3(8,110) redstone2h(8,153/181) redstone1h(9,209)
                    if (this.activeIcon === 0) {
                        this.redstone1?.plotSprite(22, 10);
                    }
                    if (this.activeIcon === 1) {
                        this.redstone2?.plotSprite(54, 8);
                    }
                    if (this.activeIcon === 2) {
                        this.redstone2?.plotSprite(82, 8);
                    }
                    if (this.activeIcon === 3) {
                        this.redstone3?.plotSprite(110, 8);
                    }
                    if (this.activeIcon === 4) {
                        this.redstone2h?.plotSprite(153, 8);
                    }
                    if (this.activeIcon === 5) {
                        this.redstone2h?.plotSprite(181, 8);
                    }
                    if (this.activeIcon === 6) {
                        this.redstone1h?.plotSprite(209, 9);
                    }
                }

                // Java sideicons plotSprite(y,x): (13,29)(11,53)(11,82)(12,115)(13,153)(11,180)(13,208)
                if (this.sideIcon[0] !== -1 && (this.tutFlashIcon !== 0 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[0]?.plotSprite(29, 13);
                }
                if (this.sideIcon[1] !== -1 && (this.tutFlashIcon !== 1 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[1]?.plotSprite(53, 11);
                }
                if (this.sideIcon[2] !== -1 && (this.tutFlashIcon !== 2 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[2]?.plotSprite(82, 11);
                }
                if (this.sideIcon[3] !== -1 && (this.tutFlashIcon !== 3 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[3]?.plotSprite(115, 12);
                }
                if (this.sideIcon[4] !== -1 && (this.tutFlashIcon !== 4 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[4]?.plotSprite(153, 13);
                }
                if (this.sideIcon[5] !== -1 && (this.tutFlashIcon !== 5 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[5]?.plotSprite(180, 11);
                }
                if (this.sideIcon[6] !== -1 && (this.tutFlashIcon !== 6 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[6]?.plotSprite(208, 13);
                }
            }

            // Java areaBackmid1.draw(160, 516) → TS (516, 160)
            this.areaBackhmid1?.draw(516, 160);

            this.areaBackbase2?.setPixels();
            this.backbase2?.plotSprite(0, 0);

            if (this.sideModalId === -1) {
                if (this.sideIcon[this.activeIcon] !== -1) {
                    // Java: redstone1v(0,42) redstone2v(0,74/102) redstone3v(1,130) redstone2hv(0,173/201) redstone1hv(0,229)
                    if (this.activeIcon === 7) {
                        this.redstone1v?.plotSprite(42, 0);
                    }
                    if (this.activeIcon === 8) {
                        this.redstone2v?.plotSprite(74, 0);
                    }
                    if (this.activeIcon === 9) {
                        this.redstone2v?.plotSprite(102, 0);
                    }
                    if (this.activeIcon === 10) {
                        this.redstone3v?.plotSprite(130, 1);
                    }
                    if (this.activeIcon === 11) {
                        this.redstone2hv?.plotSprite(173, 0);
                    }
                    if (this.activeIcon === 12) {
                        this.redstone2hv?.plotSprite(201, 0);
                    }
                    if (this.activeIcon === 13) {
                        this.redstone1hv?.plotSprite(229, 0);
                    }
                }

                // Java sideicons bottom: (2,74)(3,102)(4,137)(2,174)(2,201)(2,226) — icons[7..12] for tabs 8..13
                if (this.sideIcon[8] !== -1 && (this.tutFlashIcon !== 8 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[7]?.plotSprite(74, 2);
                }
                if (this.sideIcon[9] !== -1 && (this.tutFlashIcon !== 9 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[8]?.plotSprite(102, 3);
                }
                if (this.sideIcon[10] !== -1 && (this.tutFlashIcon !== 10 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[9]?.plotSprite(137, 4);
                }
                if (this.sideIcon[11] !== -1 && (this.tutFlashIcon !== 11 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[10]?.plotSprite(174, 2);
                }
                if (this.sideIcon[12] !== -1 && (this.tutFlashIcon !== 12 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[11]?.plotSprite(201, 2);
                }
                if (this.sideIcon[13] !== -1 && (this.tutFlashIcon !== 13 || Client.loopCycle % 20 < 10)) {
                    this.sideicons[12]?.plotSprite(226, 2);
                }
            }

            // Java areaBackbase2.draw(466, 496) → TS (496, 466)
            this.areaBackbase2?.draw(496, 466);

            this.areaGame?.setPixels();
            if (this.gameScanline) {
                Pix3D.scanline = this.gameScanline;
            }
        }

        if (this.redrawChatMode) {
            this.redrawChatMode = false;

            this.areaBackbase1?.setPixels();
            this.backbase1?.plotSprite(0, 0);

            this.p12?.centreStringTag('Public chat', 55, 28, Colour.WHITE, true);
            if (this.chatPublicMode === 0) {
                this.p12?.centreStringTag('On', 55, 41, Colour.GREEN, true);
            }
            if (this.chatPublicMode === 1) {
                this.p12?.centreStringTag('Friends', 55, 41, Colour.YELLOW, true);
            }
            if (this.chatPublicMode === 2) {
                this.p12?.centreStringTag('Off', 55, 41, Colour.RED, true);
            }
            if (this.chatPublicMode === 3) {
                this.p12?.centreStringTag('Hide', 55, 41, Colour.CYAN, true);
            }

            this.p12?.centreStringTag('Private chat', 184, 28, Colour.WHITE, true);
            if (this.chatPrivateMode === 0) {
                this.p12?.centreStringTag('On', 184, 41, Colour.GREEN, true);
            }
            if (this.chatPrivateMode === 1) {
                this.p12?.centreStringTag('Friends', 184, 41, Colour.YELLOW, true);
            }
            if (this.chatPrivateMode === 2) {
                this.p12?.centreStringTag('Off', 184, 41, Colour.RED, true);
            }

            this.p12?.centreStringTag('Trade/compete', 324, 28, Colour.WHITE, true);
            if (this.chatTradeMode === 0) {
                this.p12?.centreStringTag('On', 324, 41, Colour.GREEN, true);
            }
            if (this.chatTradeMode === 1) {
                this.p12?.centreStringTag('Friends', 324, 41, Colour.YELLOW, true);
            }
            if (this.chatTradeMode === 2) {
                this.p12?.centreStringTag('Off', 324, 41, Colour.RED, true);
            }

            this.p12?.centreStringTag('Report abuse', 458, 33, Colour.WHITE, true);

            this.areaBackbase1?.draw(0, 453);

            this.areaGame?.setPixels();
        }

        this.worldUpdateNum = 0;
    }

    /**
     * Java `areaViewport.bind()` + `Pix3D.lineOffset = areaViewportOffset` (+ centerX/Y left at init3D viewport).
     * Must run before Pix2D.cls / World.renderAll so ground projects into the 512×334 buffer.
     */
    private bindGameViewport(): void {
        this.areaGame?.setPixels();
        if (this.gameScanline) {
            Pix3D.scanline = this.gameScanline;
        }
        Pix3D.originX = this.gameOriginX;
        Pix3D.originY = this.gameOriginY;
    }

    /**
     * Port of Client-Java `drawScene` bind + render path.
     * Must bind viewport (areaGame + gameScanline) before Pix2D.cls / World.renderAll.
     */
    private drawScene(): void {
        // Java: areaViewport.bind(); Pix3D.lineOffset = areaViewportOffset;
        this.bindGameViewport();

        this.sceneCycle++;

        this.pushPlayers(true);
        this.pushNpcs(true);
        this.pushPlayers(false);
        this.pushNpcs(false);
        this.pushProjectiles();
        this.pushSpotanims();

        if (!this.cinemaCam) {
            let pitch: number = this.orbitCameraPitch;
            if (((this.cameraPitchClamp / 256) | 0) > pitch) {
                pitch = (this.cameraPitchClamp / 256) | 0;
            }
            if (this.camShake[4] && this.camShakeRan[4] + 128 > pitch) {
                pitch = this.camShakeRan[4] + 128;
            }

            const yaw: number = (this.orbitCameraYaw + this.macroCameraAngle) & 0x7ff;

            if (this.localPlayer) {
                this.orbitCamera(pitch, yaw, this.orbitCameraX, this.getHeightmapY(this.localPlayer.x, this.localPlayer.z, this.minusedlevel) - 50, this.orbitCameraZ, pitch * 3 + 600);
            }
        }

        let level: number;
        if (this.cinemaCam) {
            level = this.getTopLevelCutscene();
        } else {
            level = this.getTopLevel();
        }

        const camX: number = this.camX;
        const camY: number = this.camY;
        const camZ: number = this.camZ;
        const camPitch: number = this.camPitch;
        const camYaw: number = this.camYaw;

        for (let axis: number = 0; axis < 5; axis++) {
            if (!this.camShake[axis]) {
                continue;
            }

            const jitter = (Math.random() * (this.camShakeAxis[axis] * 2 + 1) - this.camShakeAxis[axis] + Math.sin(this.camShakeCycle[axis] * (this.camShakeAmp[axis] / 100.0)) * this.camShakeRan[axis]) | 0;
            if (axis === 0) {
                this.camX += jitter;
            } else if (axis === 1) {
                this.camY += jitter;
            } else if (axis === 2) {
                this.camZ += jitter;
            } else if (axis === 3) {
                this.camYaw = (this.camYaw + jitter) & 0x7ff;
            } else if (axis === 4) {
                this.camPitch += jitter;

                if (this.camPitch < 128) {
                    this.camPitch = 128;
                }

                if (this.camPitch > 383) {
                    this.camPitch = 383;
                }
            }
        }

        const cycle = Pix3D.cycle;
        Model.mouseCheck = true;
        Model.pickedCount = 0;
        Model.mouseX = this.mouseX - 4;
        Model.mouseY = this.mouseY - 4;

        Pix2D.cls();
        this.world?.renderAll(this.camX, this.camY, this.camZ, level, this.camYaw, this.camPitch);
        this.world?.removeSprites();
        this.draw2DEntityElements();
        this.drawTileHint();
        this.updateTextures(cycle);
        this.draw3DEntityElements();

        // Sample viewport buffer a few times after scene complete (find black-3D cause).
        const diag = this as unknown as { _drawDiagFrames?: number };
        if (typeof diag._drawDiagFrames === 'number' && diag._drawDiagFrames < 3 && this.areaGame) {
            diag._drawDiagFrames++;
            const buf = this.areaGame.data;
            let lit = 0;
            const step = 64;
            for (let i = 0; i < buf.length; i += step) {
                if ((buf[i] & 0xffffff) !== 0) {
                    lit++;
                }
            }
            console.info(
                `[377port] drawScene#${diag._drawDiagFrames} cam=${this.camX|0},${this.camY|0},${this.camZ|0} ` +
                    `pitch=${this.camPitch} yaw=${this.camYaw} level=${level} litSamples=${lit}/${(buf.length / step) | 0} ` +
                    `lp=${this.localPlayer ? `${this.localPlayer.x},${this.localPlayer.z}` : 'null'}`
            );
        }

        this.areaGame?.draw(4, 4);

        this.camX = camX;
        this.camY = camY;
        this.camZ = camZ;
        this.camPitch = camPitch;
        this.camYaw = camYaw;
    }

    /**
     * Java 377 `pushNpcs` (name is inverted in deob — this pushes **players**).
     * CYCLELOGIC6 anticheat lives in chat-mode input on 377, not here (289 had it on flag clear).
     */
    private pushPlayers(self: boolean): void {
        if (!this.localPlayer) {
            return;
        }

        // Java pushNpcs: clear minimap flag when local stands on it (no anticheat here)
        if (this.localPlayer.x >> 7 === this.minimapFlagX && this.localPlayer.z >> 7 === this.minimapFlagZ) {
            this.minimapFlagX = 0;
        }

        let count = this.playerCount;
        if (self) {
            count = 1;
        }

        for (let i: number = 0; i < count; i++) {
            let player: ClientPlayer | null;
            let id: number;
            if (self) {
                player = this.localPlayer;
                id = LOCAL_PLAYER_INDEX << 14;
            } else {
                player = this.players[this.playerIds[i]];
                id = this.playerIds[i] << 14;
            }

            if (!player || !player.isReady()) {
                continue;
            }

            player.lowMemory = false;
            if (((Client.lowMem && this.playerCount > 50) || this.playerCount > 200) && !self && player.secondaryAnim == player.readyanim) {
                player.lowMemory = true;
            }

            const stx: number = player.x >> 7;
            const stz: number = player.z >> 7;

            if (stx < 0 || stx >= BuildArea.SIZE || stz < 0 || stz >= BuildArea.SIZE) {
                continue;
            }

            if (!player.locModel || Client.loopCycle < player.locStartCycle || Client.loopCycle >= player.locStopCycle) {
                if ((player.x & 0x7f) === 64 && (player.z & 0x7f) === 64) {
                    if (this.tileLastOccupiedCycle[stx][stz] == this.sceneCycle) {
                        continue;
                    }

                    this.tileLastOccupiedCycle[stx][stz] = this.sceneCycle;
                }

                player.y = this.getHeightmapY(player.x, player.z, this.minusedlevel);
                this.world?.addDynamic(this.minusedlevel, player.x, player.y, player.z, player, id, player.yaw, 60, player.needsForwardDrawPadding);
            } else {
                player.lowMemory = false;
                player.y = this.getHeightmapY(player.x, player.z, this.minusedlevel);
                this.world?.addDynamic2(this.minusedlevel, player.x, player.y, player.z, player.minTileX, player.minTileZ, player.maxTileX, player.maxTileZ, player, id, player.yaw);
            }
        }
    }

    /**
     * Java 377 `pushPlayers` (deob name inverted — this pushes **npcs**).
     * Requires multi-npc active (method473) and marks inactive types with MIN_VALUE bit.
     */
    private pushNpcs(alwaysontop: boolean): void {
        for (let i: number = 0; i < this.npcCount; i++) {
            const npc: ClientNpc | null = this.npc[this.npcIds[i]];
            let typecode: number = ((this.npcIds[i] << 14) + 0x20000000) | 0;

            if (!npc || !npc.isReady() || !npc.type || npc.type.alwaysontop !== alwaysontop) {
                continue;
            }

            // Java NpcType.method473 — skip multi-npc when current var state is inactive slot
            if (!npc.type.isMultiActive()) {
                continue;
            }

            const x: number = npc.x >> 7;
            const z: number = npc.z >> 7;

            if (x < 0 || x >= BuildArea.SIZE || z < 0 || z >= BuildArea.SIZE) {
                continue;
            }

            if (npc.size === 1 && (npc.x & 0x7f) === 64 && (npc.z & 0x7f) === 64) {
                if (this.tileLastOccupiedCycle[x][z] === this.sceneCycle) {
                    continue;
                }

                this.tileLastOccupiedCycle[x][z] = this.sceneCycle;
            }

            // Java field1434 (active) on *base* type: false → typecode += Integer.MIN_VALUE
            if (!npc.type.active) {
                typecode = (typecode + -0x80000000) | 0;
            }

            this.world?.addDynamic(this.minusedlevel, npc.x, this.getHeightmapY(npc.x, npc.z, this.minusedlevel), npc.z, npc, typecode, npc.yaw, (npc.size - 1) * 64 + 60, npc.needsForwardDrawPadding);
        }
    }

    /** Java 377 `pushProjectiles` — track targets + CYCLELOGIC5 (248) every 51 frames. */
    private pushProjectiles(): void {
        for (let proj = this.projectiles.head(); proj !== null; proj = this.projectiles.next()) {
            if (proj.level !== this.minusedlevel || Client.loopCycle > proj.t2) {
                proj.unlink();
            } else if (Client.loopCycle >= proj.t1) {
                if (proj.target > 0) {
                    const npc: ClientNpc | null = this.npc[proj.target - 1];
                    if (npc && npc.x >= 0 && npc.x < 13312 && npc.z >= 0 && npc.z < 13312) {
                        proj.setTarget(npc.x, this.getHeightmapY(npc.x, npc.z, proj.level) - proj.h2, npc.z, Client.loopCycle);
                    }
                }

                if (proj.target < 0) {
                    const index: number = -proj.target - 1;
                    let player: ClientPlayer | null;
                    if (index === this.selfSlot) {
                        player = this.localPlayer;
                    } else {
                        player = this.players[index];
                    }

                    if (player && player.x >= 0 && player.x < 13312 && player.z >= 0 && player.z < 13312) {
                        proj.setTarget(player.x, this.getHeightmapY(player.x, player.z, proj.level) - proj.h2, player.z, Client.loopCycle);
                    }
                }

                proj.move(this.worldUpdateNum);
                this.world?.addDynamic(this.minusedlevel, proj.x | 0, proj.y | 0, proj.z | 0, proj, -1, proj.yaw, 60, false);
            }
        }

        // Java field464 / ANTICHEAT_CYCLELOGIC5 (was mis-placed as CYCLELOGIC1 / crossMode here)
        Client.cyclelogic5++;
        if (Client.cyclelogic5 > 51) {
            Client.cyclelogic5 = 0;
            this.out.p1Enc(ClientProt.ANTICHEAT_CYCLELOGIC5);
        }
    }

    private pushSpotanims(): void {
        for (let spot = this.spotanims.head(); spot !== null; spot = this.spotanims.next()) {
            if (spot.level !== this.minusedlevel || spot.animComplete) {
                spot.unlink();
            } else if (Client.loopCycle >= spot.startCycle) {
                spot.update(this.worldUpdateNum);

                if (spot.animComplete) {
                    spot.unlink();
                } else {
                    this.world?.addDynamic(spot.level, spot.x, spot.y, spot.z, spot, -1, 0, 60, false);
                }
            }
        }
    }

    private orbitCamera(pitch: number, yaw: number, targetX: number, targetY: number, targetZ: number, distance: number): void {
        const invPitch: number = (2048 - pitch) & 0x7ff;
        const invYaw: number = (2048 - yaw) & 0x7ff;

        let x: number = 0;
        let y: number = 0;
        let z: number = distance;

        let sin: number;
        let cos: number;
        let tmp: number;

        if (invPitch !== 0) {
            sin = Pix3D.sinTable[invPitch];
            cos = Pix3D.cosTable[invPitch];
            tmp = (y * cos - distance * sin) >> 16;
            z = (y * sin + distance * cos) >> 16;
            y = tmp;
        }

        if (invYaw !== 0) {
            sin = Pix3D.sinTable[invYaw];
            cos = Pix3D.cosTable[invYaw];
            tmp = (z * sin + x * cos) >> 16;
            z = (z * cos - x * sin) >> 16;
            x = tmp;
        }

        this.camX = targetX - x;
        this.camY = targetY - y;
        this.camZ = targetZ - z;
        this.camPitch = pitch;
        this.camYaw = yaw;
    }

    private getTopLevelCutscene(): number {
        if (!this.mapl) {
            return 0; // custom
        }

        const y: number = this.getHeightmapY(this.camX, this.camZ, this.minusedlevel);
        return y - this.camY >= 800 || (this.mapl[this.minusedlevel][this.camX >> 7][this.camZ >> 7] & MapFlag.RemoveRoof) === 0 ? 3 : this.minusedlevel;
    }

    /** Java 377 `getTopLevel` — roof line-of-sight + CYCLELOGIC1 anticheat when pitch < 310. */
    private getTopLevel(): number {
        let top: number = 3;

        if (this.camPitch < 310 && this.localPlayer) {
            Client.cyclelogic1++;
            if (Client.cyclelogic1 > 1457) {
                Client.cyclelogic1 = 0;
                // ANTICHEAT_CYCLELOGIC1 — p1isaac(244) + var-length body
                this.out.p1Enc(ClientProt.ANTICHEAT_CYCLELOGIC1);
                this.out.p1(0);
                const start = this.out.pos;
                this.out.p1(219);
                this.out.p2(37745);
                this.out.p1(61);
                this.out.p2(43756);
                this.out.p2((Math.random() * 65536.0) | 0);
                this.out.p1((Math.random() * 256.0) | 0);
                this.out.p2(51171);
                if (((Math.random() * 2.0) | 0) === 0) {
                    this.out.p2(15808);
                }
                this.out.p1(97);
                this.out.p1((Math.random() * 256.0) | 0);
                this.out.psize1(this.out.pos - start);
            }

            let cameraLocalTileX: number = this.camX >> 7;
            let cameraLocalTileZ: number = this.camZ >> 7;
            const playerLocalTileX: number = this.localPlayer.x >> 7;
            const playerLocalTileZ: number = this.localPlayer.z >> 7;

            if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & MapFlag.RemoveRoof) !== 0) {
                top = this.minusedlevel;
            }

            let tileDeltaX: number;
            if (playerLocalTileX > cameraLocalTileX) {
                tileDeltaX = playerLocalTileX - cameraLocalTileX;
            } else {
                tileDeltaX = cameraLocalTileX - playerLocalTileX;
            }

            let tileDeltaZ: number;
            if (playerLocalTileZ > cameraLocalTileZ) {
                tileDeltaZ = playerLocalTileZ - cameraLocalTileZ;
            } else {
                tileDeltaZ = cameraLocalTileZ - playerLocalTileZ;
            }

            if (tileDeltaX > tileDeltaZ) {
                const delta = ((tileDeltaZ * 65536) / tileDeltaX) | 0;
                let accumulator = 32768;

                while (cameraLocalTileX !== playerLocalTileX) {
                    if (cameraLocalTileX < playerLocalTileX) {
                        cameraLocalTileX++;
                    } else if (cameraLocalTileX > playerLocalTileX) {
                        cameraLocalTileX--;
                    }

                    if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & MapFlag.RemoveRoof) !== 0) {
                        top = this.minusedlevel;
                    }

                    accumulator += delta;
                    if (accumulator >= 65536) {
                        accumulator -= 65536;

                        if (cameraLocalTileZ < playerLocalTileZ) {
                            cameraLocalTileZ++;
                        } else if (cameraLocalTileZ > playerLocalTileZ) {
                            cameraLocalTileZ--;
                        }

                        if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & MapFlag.RemoveRoof) !== 0) {
                            top = this.minusedlevel;
                        }
                    }
                }
            } else {
                const delta = ((tileDeltaX * 65536) / tileDeltaZ) | 0;
                let accumulator = 32768;

                while (cameraLocalTileZ !== playerLocalTileZ) {
                    if (cameraLocalTileZ < playerLocalTileZ) {
                        cameraLocalTileZ++;
                    } else if (cameraLocalTileZ > playerLocalTileZ) {
                        cameraLocalTileZ--;
                    }

                    if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & MapFlag.RemoveRoof) !== 0) {
                        top = this.minusedlevel;
                    }

                    accumulator += delta;
                    if (accumulator >= 65536) {
                        accumulator -= 65536;

                        if (cameraLocalTileX < playerLocalTileX) {
                            cameraLocalTileX++;
                        } else if (cameraLocalTileX > playerLocalTileX) {
                            cameraLocalTileX--;
                        }

                        if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & MapFlag.RemoveRoof) !== 0) {
                            top = this.minusedlevel;
                        }
                    }
                }
            }
        }

        if (this.localPlayer && this.mapl && (this.mapl[this.minusedlevel][this.localPlayer.x >> 7][this.localPlayer.z >> 7] & MapFlag.RemoveRoof) !== 0) {
            top = this.minusedlevel;
        }

        return top;
    }

    /** Java 377 `draw2DEntityElements` — headicons, overhead chat (effects 0–5), HP bars, hitsplats. */
    private draw2DEntityElements(): void {
        this.chatCount = 0;

        for (let index: number = -1; index < this.playerCount + this.npcCount; index++) {
            let entity: ClientEntity | null = null;
            if (index === -1) {
                entity = this.localPlayer;
            } else if (index < this.playerCount) {
                entity = this.players[this.playerIds[index]];
            } else {
                entity = this.npc[this.npcIds[index - this.playerCount]];
            }

            if (!entity || !entity.isReady()) {
                continue;
            }

            if (index >= this.playerCount) {
                // Java: multi-npc method476; skip if inactive
                const npcType = (entity as ClientNpc).type?.activeType() ?? null;
                if (!npcType) {
                    continue;
                }

                // Java: imageHeadiconsPrayer[npc.field1441]
                if (npcType.headicon >= 0 && npcType.headicon < this.headiconsPrayer.length) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        this.headiconsPrayer[npcType.headicon]?.plotSprite(this.projectX - 12, this.projectY - 30);
                    }
                }

                if (this.hintType === 1 && this.hintNpc === this.npcIds[index - this.playerCount] && Client.loopCycle % 20 < 10) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        this.headiconsHint[0]?.plotSprite(this.projectX - 12, this.projectY - 28);
                    }
                }
            } else {
                // Java Client.java ~6365: field1678 (pk) then field1670 (prayer); y grows +25
                let y: number = 30;

                const player: ClientPlayer = entity as ClientPlayer;
                if (player.headiconPk !== -1 || player.headiconPrayer !== -1) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        if (player.headiconPk !== -1) {
                            this.headiconsPk[player.headiconPk]?.plotSprite(this.projectX - 12, this.projectY - y);
                            y += 25;
                        }
                        if (player.headiconPrayer !== -1) {
                            this.headiconsPrayer[player.headiconPrayer]?.plotSprite(this.projectX - 12, this.projectY - y);
                            y += 25;
                        }
                    }
                }

                if (index >= 0 && this.hintType === 10 && this.hintPlayer === this.playerIds[index]) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        this.headiconsHint[1]?.plotSprite(this.projectX - 12, this.projectY - y);
                    }
                }
            }

            if (entity.chatMessage && (index >= this.playerCount || this.chatPublicMode === 0 || this.chatPublicMode === 3 || (this.chatPublicMode === 1 && this.isFriend((entity as ClientPlayer).name)))) {
                this.projectFromEntity(entity, entity.height);

                if (this.projectX > -1 && this.chatCount < MAX_CHATS && this.b12) {
                    this.chatWidth[this.chatCount] = (this.b12.stringWid(entity.chatMessage) / 2) | 0;
                    this.chatHeight[this.chatCount] = this.b12.height;
                    this.chatX[this.chatCount] = this.projectX;
                    this.chatY[this.chatCount] = this.projectY;

                    this.chatColour[this.chatCount] = entity.chatColour;
                    this.chatEffect[this.chatCount] = entity.chatEffect;
                    this.chatTimer[this.chatCount] = entity.chatTimer;
                    this.chats[this.chatCount++] = entity.chatMessage as string;

                    // Java writes to chatCount *after* ++ (next slot) — keep exact off-by-one
                    if (this.chatEffects === 0 && entity.chatEffect >= 1 && entity.chatEffect <= 3) {
                        this.chatHeight[this.chatCount] += 10;
                        this.chatY[this.chatCount] += 5;
                    }

                    if (this.chatEffects === 0 && entity.chatEffect === 4) {
                        this.chatWidth[this.chatCount] = 60;
                    }

                    if (this.chatEffects === 0 && entity.chatEffect === 5) {
                        this.chatHeight[this.chatCount] += 5;
                    }
                }
            }

            // Java field1142 > loopCycle (HP bar for 300 ticks after damage)
            if (entity.combatCycle > Client.loopCycle) {
                this.projectFromEntity(entity, entity.height + 15);

                if (this.projectX > -1) {
                    let w: number = ((entity.health * 30) / entity.totalHealth) | 0;
                    if (w > 30) {
                        w = 30;
                    }
                    Pix2D.fillRect(this.projectX - 15, this.projectY - 3, w, 5, Colour.GREEN);
                    Pix2D.fillRect(this.projectX - 15 + w, this.projectY - 3, 30 - w, 5, Colour.RED);
                }
            }

            for (let i = 0; i < 4; ++i) {
                if (entity.damageCycles[i] <= Client.loopCycle) {
                    continue;
                }

                this.projectFromEntity(entity, (entity.height / 2) | 0);

                if (this.projectX <= -1) {
                    continue;
                }

                if (i == 1) {
                    this.projectY -= 20;
                } else if (i == 2) {
                    this.projectX -= 15;
                    this.projectY -= 10;
                } else if (i == 3) {
                    this.projectX += 15;
                    this.projectY -= 10;
                }

                this.hitmarks[entity.damageTypes[i]]?.plotSprite(this.projectX - 12, this.projectY - 12);
                this.p11?.centreString(entity.damageValues[i].toString(), this.projectX, this.projectY + 4, Colour.BLACK);
                this.p11?.centreString(entity.damageValues[i].toString(), this.projectX - 1, this.projectY + 3, Colour.WHITE);
            }
        }

        for (let i: number = 0; i < this.chatCount; i++) {
            const x: number = this.chatX[i];
            let y: number = this.chatY[i];
            const padding: number = this.chatWidth[i];
            const height: number = this.chatHeight[i];

            let sorting: boolean = true;
            while (sorting) {
                sorting = false;
                for (let j: number = 0; j < i; j++) {
                    if (y + 2 > this.chatY[j] - this.chatHeight[j] && y - height < this.chatY[j] + 2 && x - padding < this.chatX[j] + this.chatWidth[j] && x + padding > this.chatX[j] - this.chatWidth[j] && this.chatY[j] - this.chatHeight[j] < y) {
                        y = this.chatY[j] - this.chatHeight[j];
                        sorting = true;
                    }
                }
            }

            this.projectX = this.chatX[i];
            this.projectY = this.chatY[i] = y;

            const message: string | null = this.chats[i];

            if (this.chatEffects !== 0) {
                this.b12?.centreString(message, this.projectX, this.projectY + 1, Colour.BLACK);
                this.b12?.centreString(message, this.projectX, this.projectY, Colour.YELLOW);
            } else {
                let colour: number = Colour.YELLOW;
                if (this.chatColour[i] < 6) {
                    colour = CHAT_COLOURS[this.chatColour[i]];
                } else if (this.chatColour[i] === 6) {
                    colour = this.sceneCycle % 20 < 10 ? Colour.RED : Colour.YELLOW;
                } else if (this.chatColour[i] === 7) {
                    colour = this.sceneCycle % 20 < 10 ? Colour.BLUE : Colour.CYAN;
                } else if (this.chatColour[i] === 8) {
                    colour = this.sceneCycle % 20 < 10 ? 0xb000 : 0x80ff80;
                } else if (this.chatColour[i] === 9) {
                    const delta: number = 150 - this.chatTimer[i];
                    if (delta < 50) {
                        colour = delta * 1280 + Colour.RED;
                    } else if (delta < 100) {
                        colour = Colour.YELLOW - (delta - 50) * 327680;
                    } else if (delta < 150) {
                        colour = (delta - 100) * 5 + Colour.GREEN;
                    }
                } else if (this.chatColour[i] === 10) {
                    const delta: number = 150 - this.chatTimer[i];
                    if (delta < 50) {
                        colour = delta * 5 + Colour.RED;
                    } else if (delta < 100) {
                        colour = Colour.MAGENTA - (delta - 50) * 327680;
                    } else if (delta < 150) {
                        colour = (delta - 100) * 327680 + Colour.BLUE - (delta - 100) * 5;
                    }
                } else if (this.chatColour[i] === 11) {
                    const delta: number = 150 - this.chatTimer[i];
                    if (delta < 50) {
                        colour = Colour.WHITE - delta * 327685;
                    } else if (delta < 100) {
                        colour = (delta - 50) * 327685 + Colour.GREEN;
                    } else if (delta < 150) {
                        colour = Colour.WHITE - (delta - 100) * 327680;
                    }
                }

                if (this.chatEffect[i] === 0) {
                    this.b12?.centreString(message, this.projectX, this.projectY + 1, Colour.BLACK);
                    this.b12?.centreString(message, this.projectX, this.projectY, colour);
                } else if (this.chatEffect[i] === 1) {
                    this.b12?.centreStringWave(message, this.projectX, this.projectY + 1, Colour.BLACK, this.sceneCycle);
                    this.b12?.centreStringWave(message, this.projectX, this.projectY, colour, this.sceneCycle);
                } else if (this.chatEffect[i] === 2) {
                    this.b12?.centreStringWave2(message, this.projectX, this.projectY + 1, Colour.BLACK, this.sceneCycle);
                    this.b12?.centreStringWave2(message, this.projectX, this.projectY, colour, this.sceneCycle);
                } else if (this.chatEffect[i] === 3) {
                    this.b12?.centreStringShake(message, this.projectX, this.projectY + 1, Colour.BLACK, 150 - this.chatTimer[i], this.sceneCycle);
                    this.b12?.centreStringShake(message, this.projectX, this.projectY, colour, 150 - this.chatTimer[i], this.sceneCycle);
                } else if (this.chatEffect[i] === 4) {
                    const w: number = this.b12?.stringWid(message) ?? 0;
                    const offsetX: number = (((150 - this.chatTimer[i]) * (w + 100)) / 150) | 0;
                    Pix2D.setClipping(this.projectX - 50, 0, this.projectX + 50, 334);
                    this.b12?.drawString(message, this.projectX + 50 - offsetX, this.projectY + 1, Colour.BLACK);
                    this.b12?.drawString(message, this.projectX + 50 - offsetX, this.projectY, colour);
                    Pix2D.resetClipping();
                } else if (this.chatEffect[i] === 5) {
                    const delta: number = 150 - this.chatTimer[i];
                    let offsetY: number = 0;
                    if (delta < 25) {
                        offsetY = delta - 25;
                    } else if (delta > 125) {
                        offsetY = delta - 125;
                    }
                    const fontH: number = this.b12?.height ?? 0;
                    Pix2D.setClipping(0, this.projectY - fontH - 1, 512, this.projectY + 5);
                    this.b12?.centreString(message, this.projectX, this.projectY + 1 + offsetY, Colour.BLACK);
                    this.b12?.centreString(message, this.projectX, this.projectY + offsetY, colour);
                    Pix2D.resetClipping();
                }
            }
        }
    }

    private drawTileHint(): void {
        // Java drawTileHint: imageHeadiconsHint[0]
        if (this.hintType !== 2 || !this.headiconsHint[0]) {
            return;
        }

        this.projectFromGround(((this.hintTileX - this.mapBuildBaseX) << 7) + this.hintOffsetX, ((this.hintTileZ - this.mapBuildBaseZ) << 7) + this.hintOffsetZ, this.hintHeight * 2);

        if (this.projectX > -1 && Client.loopCycle % 20 < 10) {
            this.headiconsHint[0].plotSprite(this.projectX - 12, this.projectY - 28);
        }
    }

    /** Java 377 `updateTextures` — scroll ANIMATED_TEXTURES {17,24,34,40} when cycle hot. */
    private updateTextures(cycle: number): void {
        if (Client.lowMem) {
            return;
        }

        for (let i: number = 0; i < this.animatedTextures.length; i++) {
            const texId: number = this.animatedTextures[i];
            if (Pix3D.texCycle[texId] < cycle) {
                continue;
            }

            const texture: Pix8 | null = Pix3D.textures[texId];
            if (!texture) {
                continue;
            }

            const bottom: number = texture.wi * texture.hi - 1;
            const adjustment: number = texture.wi * this.worldUpdateNum * 2;

            const src: Int8Array = texture.data;
            const dst: Int8Array = this.textureBuffer;
            for (let p: number = 0; p <= bottom; p++) {
                dst[p] = src[(p - adjustment) & bottom];
            }

            texture.data = dst;
            this.textureBuffer = src;
            Pix3D.pushTexture(texId);
        }
    }

    /** Java 377 `draw3DEntityElements` — private chat, cross, viewport IFs, world area, menu/tooltip, FPS, system update. */
    private draw3DEntityElements(): void {
        this.drawPrivateMessages();

        if (this.crossMode === 1) {
            this.cross[(this.crossCycle / 100) | 0]?.plotSprite(this.crossX - 8 - 4, this.crossY - 8 - 4);
        }
        if (this.crossMode === 2) {
            this.cross[((this.crossCycle / 100) | 0) + 4]?.plotSprite(this.crossX - 8 - 4, this.crossY - 8 - 4);
            // CYCLELOGIC5 lives in pushProjectiles on 377 (not on crossMode)
        }

        if (this.mainOverlayId !== -1) {
            this.updateInterfaceAnimation(this.mainOverlayId, this.worldUpdateNum);
            this.drawInterface(IfType.get(this.mainOverlayId), 0, 0, 0);
        }

        if (this.mainModalId !== -1) {
            this.updateInterfaceAnimation(this.mainModalId, this.worldUpdateNum);
            this.drawInterface(IfType.get(this.mainModalId), 0, 0, 0);
        }

        this.updateWorldLocation();

        if (!this.isMenuOpen) {
            this.handleInput();
            this.showPopupMessage();
        } else if (this.menuArea === 0) {
            this.drawMenu();
        }

        if (this.inMultizone === 1) {
            // Java: imageOverlayMultiway.plotSprite(296, 472) — Pix32 arg order may swap
            this.overlayMultiway?.plotSprite(472, 296);
        }

        if (this.showFps) {
            const x: number = 507;
            let y: number = 20;

            // Java: red if fps < 30 (lowMem) or < 20 (!lowMem)
            let colour: number = Colour.YELLOW;
            if (this.fps < 30 && Client.lowMem) {
                colour = Colour.RED;
            }
            if (this.fps < 20 && !Client.lowMem) {
                colour = Colour.RED;
            }

            this.p12?.drawStringRight('Fps:' + this.fps, x, y, colour);
            y += 15;

            let memoryUsage = -1;
            if (typeof window.performance['memory' as keyof Performance] !== 'undefined') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const memory = window.performance['memory' as keyof Performance] as any;
                memoryUsage = (memory.usedJSHeapSize / 1024) | 0;
            }

            // Java always draws Mem in yellow (dead colour locals unused)
            if (memoryUsage !== -1) {
                this.p12?.drawStringRight('Mem:' + memoryUsage + 'k', x, y, Colour.YELLOW);
            }
        }

        if (this.rebootTimer !== 0) {
            let seconds: number = (this.rebootTimer / 50) | 0;
            const minutes: number = (seconds / 60) | 0;
            seconds %= 60;

            if (seconds < 10) {
                this.p12?.drawString('System update in: ' + minutes + ':0' + seconds, 4, 329, Colour.YELLOW);
            } else {
                this.p12?.drawString('System update in: ' + minutes + ':' + seconds, 4, 329, Colour.YELLOW);
            }

            // Java draw3DEntityElements: cyclelogic3 > 112 → ANTICHEAT_CYCLELOGIC3 (197) + p4(0)
            Client.cyclelogic3++;
            if (Client.cyclelogic3 > 112) {
                Client.cyclelogic3 = 0;
                this.out.p1Enc(ClientProt.ANTICHEAT_CYCLELOGIC3);
                this.out.p4(0);
            }
        }
    }

    // todo: order
    private drawPrivateMessages(): void {
        if (this.splitPrivateChat === 0) {
            return;
        }

        const font: PixFont | null = this.p12;
        let lineOffset: number = 0;
        if (this.rebootTimer !== 0) {
            lineOffset = 1;
        }

        for (let i: number = 0; i < 100; i++) {
            if (!this.chatText[i]) {
                continue;
            }

            const type: number = this.chatType[i];
            let sender = this.chatUsername[i];

            let modlevel = 0;
            if (sender && sender.startsWith('@cr1@')) {
                sender = sender.substring(5);
                modlevel = 1;
            } else if (sender && sender.startsWith('@cr2@')) {
                sender = sender.substring(5);
                modlevel = 2;
            }

            if ((type == 3 || type == 7) && (type == 7 || this.chatPrivateMode == 0 || (this.chatPrivateMode == 1 && this.isFriend(sender)))) {
                const y = 329 - lineOffset * 13;
                let x = 4;

                font?.drawString('From', 4, y, Colour.BLACK);
                font?.drawString('From', 4, y - 1, Colour.CYAN);
                x += font?.stringWid('From ') ?? 0;

                if (modlevel == 1) {
                    this.modIcons[0].plotSprite(x, y - 12);
                    x += 14;
                } else if (modlevel == 2) {
                    this.modIcons[1].plotSprite(x, y - 12);
                    x += 14;
                }

                font?.drawString(sender + ': ' + this.chatText[i], x, y, Colour.BLACK);
                font?.drawString(sender + ': ' + this.chatText[i], x, y - 1, Colour.CYAN);

                lineOffset++;
                if (lineOffset >= 5) {
                    return;
                }
            } else if (type === 5 && this.chatPrivateMode < 2) {
                const y = 329 - lineOffset * 13;

                font?.drawString(this.chatText[i], 4, y, Colour.BLACK);
                font?.drawString(this.chatText[i], 4, y - 1, Colour.CYAN);

                lineOffset++;
                if (lineOffset >= 5) {
                    return;
                }
            } else if (type === 6 && this.chatPrivateMode < 2) {
                const y = 329 - lineOffset * 13;

                font?.drawString('To ' + sender + ': ' + this.chatText[i], 4, y, Colour.BLACK);
                font?.drawString('To ' + sender + ': ' + this.chatText[i], 4, y - 1, Colour.CYAN);

                lineOffset++;
                if (lineOffset >= 5) {
                    return;
                }
            }
        }
    }

    // todo: order
    private updateWorldLocation(): void {
        if (!this.localPlayer) {
            return;
        }

        const x: number = (this.localPlayer.x >> 7) + this.mapBuildBaseX;
        const z: number = (this.localPlayer.z >> 7) + this.mapBuildBaseZ;

        this.chatDisabled = 0;

        // tutorial island
        if (x >= 3053 && x <= 3156 && z >= 3056 && z <= 3136) {
            this.chatDisabled = 1;
        } else if (x >= 3072 && x <= 3118 && z >= 9492 && z <= 9535) {
            this.chatDisabled = 1;
        }

        if (this.chatDisabled === 1 && x >= 3139 && x <= 3199 && z >= 3008 && z <= 3062) {
            this.chatDisabled = 0;
        }
    }

    private projectFromEntity(entity: ClientEntity, height: number): void {
        this.projectFromGround(entity.x, entity.z, height);
    }

    private projectFromGround(x: number, z: number, height: number): void {
        if (x < 128 || z < 128 || x > 13056 || z > 13056) {
            this.projectX = -1;
            this.projectY = -1;
            return;
        }

        const y: number = this.getHeightmapY(x, z, this.minusedlevel) - height;

        let dx: number = x - this.camX;
        let dy: number = y - this.camY;
        let dz: number = z - this.camZ;

        const sinPitch: number = Pix3D.sinTable[this.camPitch];
        const cosPitch: number = Pix3D.cosTable[this.camPitch];
        const sinYaw: number = Pix3D.sinTable[this.camYaw];
        const cosYaw: number = Pix3D.cosTable[this.camYaw];

        let tmp: number = (dz * sinYaw + dx * cosYaw) >> 16;
        dz = (dz * cosYaw - dx * sinYaw) >> 16;
        dx = tmp;

        tmp = (dy * cosPitch - dz * sinPitch) >> 16;
        dz = (dy * sinPitch + dz * cosPitch) >> 16;
        dy = tmp;

        if (dz >= 50) {
            this.projectX = Pix3D.originX + (((dx << 9) / dz) | 0);
            this.projectY = Pix3D.originY + (((dy << 9) / dz) | 0);
        } else {
            this.projectX = -1;
            this.projectY = -1;
        }
    }

    private getHeightmapY(sceneX: number, sceneZ: number, level: number): number {
        if (!this.groundh) {
            return 0; // custom
        }

        const tileX: number = sceneX >> 7;
        const tileZ: number = sceneZ >> 7;

        if (tileX < 0 || tileZ < 0 || tileX > 103 || tileZ > 103) {
            return 0;
        }

        let realLevel: number = level;
        if (level < 3 && this.mapl && (this.mapl[1][tileX][tileZ] & MapFlag.LinkBelow) !== 0) {
            realLevel = level + 1;
        }

        const tileLocalX: number = sceneX & 0x7f;
        const tileLocalZ: number = sceneZ & 0x7f;
        const y00: number = (this.groundh[realLevel][tileX][tileZ] * (128 - tileLocalX) + this.groundh[realLevel][tileX + 1][tileZ] * tileLocalX) >> 7;
        const y11: number = (this.groundh[realLevel][tileX][tileZ + 1] * (128 - tileLocalX) + this.groundh[realLevel][tileX + 1][tileZ + 1] * tileLocalX) >> 7;
        return (y00 * (128 - tileLocalZ) + y11 * tileLocalZ) >> 7;
    }

    /**
     * Port of Client-Java `updateSceneState` (377).
     * Also rebuilds minimap on level change.
     */
    private updateSceneState(): void {
        // Java: lowMem && sceneState==2 && World.field125 != currentLevel → popup + sceneState=1
        if (Client.lowMem && this.sceneState === 2 && ClientBuild.minusedlevel !== this.minusedlevel) {
            this.areaGame?.setPixels();
            this.p12?.centreString('Loading - please wait.', 257, 151, Colour.BLACK);
            this.p12?.centreString('Loading - please wait.', 256, 150, Colour.WHITE);
            this.areaGame?.draw(4, 4);
            this.sceneState = 1;
            this.sceneLoadStartTime = performance.now();
        }

        if (this.sceneState === 1) {
            const status = this.checkScene();
            // Port diagnostics: log scene blockers every ~2s while loading
            const nowMs = performance.now();
            if (!(this as unknown as { _sceneDiagAt?: number })._sceneDiagAt) {
                (this as unknown as { _sceneDiagAt?: number })._sceneDiagAt = 0;
            }
            if (status !== 0 && nowMs - ((this as unknown as { _sceneDiagAt?: number })._sceneDiagAt ?? 0) > 2000) {
                (this as unknown as { _sceneDiagAt?: number })._sceneDiagAt = nowMs;
                let missingLand = 0;
                let missingLoc = 0;
                if (this.mapBuildGroundData && this.mapBuildLocationData && this.mapBuildGroundFile && this.mapBuildLocationFile) {
                    for (let i = 0; i < this.mapBuildGroundData.length; i++) {
                        if (this.mapBuildGroundData[i] == null && this.mapBuildGroundFile[i] !== -1) {
                            missingLand++;
                        }
                        if (this.mapBuildLocationData[i] == null && this.mapBuildLocationFile[i] !== -1) {
                            missingLoc++;
                        }
                    }
                }
                const rem = this.onDemand?.remaining() ?? -1;
                // rem===0 + status -1/-2/-3 often means failed delivery never applied (was null-skip bug)
                // or model version=0 so request() silently no-ops
                console.info(
                    `[377port] scene loading status=${status} awaitInfo=${this.awaitingPlayerInfo} missingLand=${missingLand} missingLoc=${missingLoc} onDemandRem=${rem} zones=${this.mapBuildCentreZoneX},${this.mapBuildCentreZoneZ}` +
                        (rem === 0 && status < 0 ? ' STUCK_HINT=rem0_check_null_completions_or_version0' : '')
                );
            }
            if (status === 0) {
                // One-shot post-build diagnostic (Java buildScene success path).
                let tiles = 0;
                let withGround = 0;
                let withQuick = 0;
                const sqs = (this.world as unknown as { squares?: ( { ground?: unknown; quickGround?: unknown } | null )[][][] })?.squares;
                if (sqs) {
                    for (let l = 0; l < 4; l++) {
                        for (let x = 0; x < 104; x++) {
                            for (let z = 0; z < 104; z++) {
                                const sq = sqs[l]?.[x]?.[z];
                                if (sq) {
                                    tiles++;
                                    if (sq.ground) {
                                        withGround++;
                                    }
                                    if (sq.quickGround) {
                                        withQuick++;
                                    }
                                }
                            }
                        }
                    }
                }
                const lp = this.localPlayer;
                console.info(
                    `[377port] scene complete → sceneState=2 mapBuild done tiles=${tiles} withGround=${withGround} withQuick=${withQuick} ` +
                        `world=${!!this.world} areaGame=${!!this.areaGame} origin=${Pix3D.originX},${Pix3D.originY} ` +
                        `lp=${lp ? `${lp.x},${lp.z}` : 'null'} ` +
                        `orbit=${this.orbitCameraX},${this.orbitCameraZ} base=${this.mapBuildBaseX},${this.mapBuildBaseZ} ` +
                        `zones=${this.mapBuildCentreZoneX},${this.mapBuildCentreZoneZ} level=${this.minusedlevel} ` +
                        `minBuilt=${ClientBuild.minBuiltLevel}`
                );
                (this as unknown as { _drawDiagFrames?: number })._drawDiagFrames = 0;
            }
            // Java: signlink.reporterror glcfb after 360000 ms stuck in sceneState=1
            if (status != 0 && performance.now() - this.sceneLoadStartTime > 360000) {
                console.log(`${this.loginUser} glcfb ${this.loginSeed},${status},${Client.lowMem},${this.db !== null},${this.onDemand?.remaining()},${this.minusedlevel},${this.mapBuildCentreZoneX},${this.mapBuildCentreZoneZ}`);
                this.sceneLoadStartTime = performance.now();
            }
        }

        // Java: sceneState==2 && minimapLevel != currentLevel → createMinimap
        if (this.sceneState === 2 && this.minusedlevel !== this.minimapLevel) {
            this.minimapLevel = this.minusedlevel;
            this.createMinimap(this.minusedlevel);
        }
    }

    /**
     * Port of Client-Java `checkScene` (377).
     * Returns 0 when land/loc bytes + loc models ready and map build finished; else -1..-4.
     */
    private checkScene(): number {
        // Java assumes arrays allocated after REBUILD; TS guards instead of NPE.
        if (!this.mapBuildIndex || !this.mapBuildGroundData || !this.mapBuildLocationData) {
            return -1000; // custom (pre-REBUILD)
        }

        for (let i = 0; i < this.mapBuildGroundData.length; i++) {
            if (this.mapBuildGroundData[i] == null && this.mapBuildGroundFile[i] !== -1) {
                return -1;
            }

            if (this.mapBuildLocationData[i] == null && this.mapBuildLocationFile[i] !== -1) {
                return -2;
            }
        }

        let ready = true;
        const missingModels: { id: number; locId: number; name: string | null }[] = [];
        const collectMissing = this.onDemand != null && this.onDemand.remaining() === 0;
        for (let i = 0; i < this.mapBuildGroundData.length; i++) {
            const data = this.mapBuildLocationData[i];
            if (data != null) {
                // Java method29(var6, var7, data); sceneInstanced forces (10, 10)
                let x = (this.mapBuildIndex[i] >> 8) * 64 - this.mapBuildBaseX;
                let z = (this.mapBuildIndex[i] & 0xff) * 64 - this.mapBuildBaseZ;
                if (this.sceneInstanced) {
                    x = 10;
                    z = 10;
                }
                if (!ClientBuild.checkLocations(data, x, z, collectMissing ? missingModels : undefined)) {
                    ready = false;
                }
            }
        }

        if (!ready) {
            // One-shot: rem==0 but models still missing → request() silent no-op (version 0 / OOB)
            if (collectMissing && missingModels.length > 0) {
                const nowMs = performance.now();
                const last = (this as unknown as { _missingModelDiagAt?: number })._missingModelDiagAt ?? 0;
                if (nowMs - last > 5000) {
                    (this as unknown as { _missingModelDiagAt?: number })._missingModelDiagAt = nowMs;
                    const sample = missingModels.slice(0, 12).map(m => {
                        const ver = this.onDemand?.versions?.[0]?.[m.id];
                        const nVer = this.onDemand?.versions?.[0]?.length ?? 0;
                        return `m${m.id}@loc${m.locId}(${m.name ?? '?'}) ver=${ver ?? 'undef'} nVer=${nVer}`;
                    });
                    console.warn(`[377port] status=-3 rem=0 missingModels=${missingModels.length} sample=${sample.join(' | ')}`);
                }
            }
            return -3;
        } else if (this.awaitingPlayerInfo) {
            // Java awaitingSync
            return -4;
        }

        this.sceneState = 2;
        // Java: World.field125 = this.currentLevel
        ClientBuild.minusedlevel = this.minusedlevel;
        this.buildScene();
        // MAP_BUILD_COMPLETE
        this.out.p1Enc(ClientProt.MAP_BUILD_COMPLETE);
        return 0;
    }

    /**
     * Port of Client-Java `buildScene` (377).
     * Land helpers live in ClientBuild (method22/28/27/15 + instanced method14/16/20).
     */
    private buildScene(): void {
        try {
            this.minimapLevel = -1;
            this.spotanims.clear();
            this.projectiles.clear();
            Pix3D.clearTexels();
            this.clearCache();
            this.world?.resetMap();
            // Java System.gc() — N/A in browser

            for (let level: number = 0; level < BuildArea.LEVELS; level++) {
                this.collision[level]?.reset();
            }

            // Java: clear levelTileFlags[4][104][104] before method22/method15.
            if (this.mapl) {
                for (let level: number = 0; level < BuildArea.LEVELS; level++) {
                    for (let x: number = 0; x < BuildArea.SIZE; x++) {
                        this.mapl[level][x].fill(0);
                    }
                }
            }

            // Java: new World(heightmap, tileFlags, 104, 104) resets field113=99
            const build: ClientBuild = new ClientBuild(BuildArea.SIZE, BuildArea.SIZE, this.groundh!, this.mapl!);
            const maps: number = this.mapBuildGroundData?.length ?? 0;

            // Java World.lowMem is static (set with Client.lowMem at mem budget); no map-grid override in 377 buildScene.
            ClientBuild.lowMem = World.lowMem;

            // Java buildScene: NO_TIMEOUT then !sceneInstanced | sceneInstanced branches
            this.out.p1Enc(ClientProt.NO_TIMEOUT);

            if (!this.sceneInstanced) {
                if (this.mapBuildIndex && this.mapBuildGroundData) {
                    for (let i: number = 0; i < maps; i++) {
                        const x: number = (this.mapBuildIndex[i] >> 8) * 64 - this.mapBuildBaseX;
                        const z: number = (this.mapBuildIndex[i] & 0xff) * 64 - this.mapBuildBaseZ;
                        const data: Uint8Array | null = this.mapBuildGroundData[i];

                        if (data) {
                            // Java method22(z, (centreZ-6)*8, x, data, (centreX-6)*8, coll)
                            build.loadGround(data, (this.mapBuildCentreZoneX - 6) * 8, (this.mapBuildCentreZoneZ - 6) * 8, x, z);
                        }
                    }

                    for (let i: number = 0; i < maps; i++) {
                        const x: number = (this.mapBuildIndex[i] >> 8) * 64 - this.mapBuildBaseX;
                        const z: number = (this.mapBuildIndex[i] & 0xff) * 64 - this.mapBuildBaseZ;
                        const data: Uint8Array | null = this.mapBuildGroundData[i];

                        if (!data && this.mapBuildCentreZoneZ < 800) {
                            // Java method28(x, z, 64, 64) ≡ fadeAdjacent(startZ=z, startX=x, 64, 64)
                            build.fadeAdjacent(z, x, 64, 64);
                        }
                    }
                }

                if (this.mapBuildIndex && this.mapBuildLocationData) {
                    this.out.p1Enc(ClientProt.NO_TIMEOUT);

                    for (let i: number = 0; i < maps; i++) {
                        const data: Uint8Array | null = this.mapBuildLocationData[i];

                        if (data) {
                            const x: number = (this.mapBuildIndex[i] >> 8) * 64 - this.mapBuildBaseX;
                            const z: number = (this.mapBuildIndex[i] & 0xff) * 64 - this.mapBuildBaseZ;
                            // Java method27(z, coll, x, scene, data)
                            build.loadLocations(data, x, z, this.world, this.collision);
                        }
                    }
                }
            } else {
                // Java sceneInstanced path: 4×13×13 chunk ground then locs
                for (let level: number = 0; level < 4; level++) {
                    for (let chunkY: number = 0; chunkY < 13; chunkY++) {
                        for (let chunkX: number = 0; chunkX < 13; chunkX++) {
                            let loaded: boolean = false;
                            const key: number = this.sceneMapRegion[level][chunkY][chunkX];
                            if (key !== -1) {
                                const rotation: number = (key >> 1) & 0x3;
                                const srcLevel: number = (key >> 24) & 0x3;
                                const mapX: number = (key >> 14) & 0x3ff;
                                const mapZ: number = (key >> 3) & 0x7ff;
                                const mapKey: number = (((mapX / 8) | 0) << 8) + ((mapZ / 8) | 0);
                                if (this.mapBuildIndex && this.mapBuildGroundData) {
                                    for (let i: number = 0; i < this.mapBuildIndex.length; i++) {
                                        if (this.mapBuildIndex[i] === mapKey && this.mapBuildGroundData[i] != null) {
                                            // Java method16(rot, (mapZ&7)*8, land, level, srcLevel, chunkY*8, coll, chunkX*8, (mapX&7)*8)
                                            build.loadGroundChunk(
                                                rotation,
                                                (mapZ & 0x7) * 8,
                                                this.mapBuildGroundData[i]!,
                                                level,
                                                srcLevel,
                                                chunkY * 8,
                                                this.collision,
                                                chunkX * 8,
                                                (mapX & 0x7) * 8
                                            );
                                            loaded = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (!loaded) {
                                // Java method14(level, chunkX*8, chunkY*8)
                                build.clearChunk(level, chunkX * 8, chunkY * 8);
                            }
                        }
                    }
                }

                for (let chunkY: number = 0; chunkY < 13; chunkY++) {
                    for (let chunkX: number = 0; chunkX < 13; chunkX++) {
                        if (this.sceneMapRegion[0][chunkY][chunkX] === -1) {
                            // Java method28(chunkY*8, chunkX*8, 8, 8)
                            build.fadeAdjacent(chunkX * 8, chunkY * 8, 8, 8);
                        }
                    }
                }

                this.out.p1Enc(ClientProt.NO_TIMEOUT);

                for (let level: number = 0; level < 4; level++) {
                    for (let chunkY: number = 0; chunkY < 13; chunkY++) {
                        for (let chunkX: number = 0; chunkX < 13; chunkX++) {
                            const key: number = this.sceneMapRegion[level][chunkY][chunkX];
                            if (key === -1) {
                                continue;
                            }
                            const srcLevel: number = (key >> 24) & 0x3;
                            const rotation: number = (key >> 1) & 0x3;
                            const mapX: number = (key >> 14) & 0x3ff;
                            const mapZ: number = (key >> 3) & 0x7ff;
                            const mapKey: number = (((mapX / 8) | 0) << 8) + ((mapZ / 8) | 0);
                            if (this.mapBuildIndex && this.mapBuildLocationData) {
                                for (let i: number = 0; i < this.mapBuildIndex.length; i++) {
                                    if (this.mapBuildIndex[i] === mapKey && this.mapBuildLocationData[i] != null) {
                                        // Java method20(level, coll, scene, loc, chunkX*8, rot, (mapX&7)*8, chunkY*8, (mapZ&7)*8, srcLevel)
                                        build.loadLocsChunk(
                                            level,
                                            this.collision,
                                            this.world,
                                            this.mapBuildLocationData[i]!,
                                            chunkX * 8,
                                            rotation,
                                            (mapX & 0x7) * 8,
                                            chunkY * 8,
                                            (mapZ & 0x7) * 8,
                                            srcLevel
                                        );
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            this.out.p1Enc(ClientProt.NO_TIMEOUT);

            // Java method15(coll, scene)
            build.finishBuild(this.world, this.collision);

            // Java order after method15: areaViewport.bind → NO_TIMEOUT → method275 → sortObjStacks → clearLocChanges
            this.bindGameViewport();
            this.out.p1Enc(ClientProt.NO_TIMEOUT);

            // Java: if (lowMem) scene.method275(World.field113); else method275(0)
            // (dead var44 adjust toward currentLevel is present in Java but unused for the call)
            let baseLevel = 0;
            if (Client.lowMem) {
                baseLevel = ClientBuild.minBuiltLevel;
                // Safety: field113 can stay 99 if no tile passed lowMem gate → OOB draw
                if (baseLevel < 0 || baseLevel >= BuildArea.LEVELS) {
                    console.warn(`[377port] minBuiltLevel=${baseLevel} invalid after finishBuild; clamping to 0`);
                    baseLevel = 0;
                }
            }
            this.world?.fillBaseLevel(baseLevel);

            for (let x: number = 0; x < BuildArea.SIZE; x++) {
                for (let z: number = 0; z < BuildArea.SIZE; z++) {
                    this.sortObjStacks(x, z);
                }
            }

            this.clearLocChanges();
        } catch (e) {
            console.error(e);
        }

        LocType.mc1?.clear();

        // Java: if (super.frame != null) p1isaac(78) EVENT_HAS_WINDOW + p4(1057001181)
        // Browser has no applet Frame — omit (ClientProt.EVENT_HAS_WINDOW reserved).

        if (Client.lowMem && this.db) {
            const modelCount = this.onDemand?.getFileCount(0) ?? 0;

            for (let i = 0; i < modelCount; i++) {
                const flags = this.onDemand?.getModelUse(i) ?? 0;

                if ((flags & 0x79) == 0) {
                    Model.unload(i);
                }
            }
        }

        // Java System.gc() after model unload — N/A
        Pix3D.initPool(20);
        this.onDemand?.clearPrefetches();

        let left = (((this.mapBuildCentreZoneX - 6) / 8) | 0) - 1;
        let right = (((this.mapBuildCentreZoneX + 6) / 8) | 0) + 1;
        let bottom = (((this.mapBuildCentreZoneZ - 6) / 8) | 0) - 1;
        let top = (((this.mapBuildCentreZoneZ + 6) / 8) | 0) + 1;

        if (this.withinTutorialIsland) {
            left = 49;
            right = 50;
            bottom = 49;
            top = 50;
        }

        for (let x = left; x <= right; x++) {
            for (let z = bottom; z <= top; z++) {
                if (left == x || right == x || bottom == z || top == z) {
                    // Java prefetch(file, archive) — TS prefetch(archive, file)
                    const land = this.onDemand?.getMapFile(x, z, 0) ?? -1;
                    if (land != -1) {
                        this.onDemand?.prefetch(3, land);
                    }

                    const loc = this.onDemand?.getMapFile(x, z, 1) ?? -1;
                    if (loc != -1) {
                        this.onDemand?.prefetch(3, loc);
                    }
                }
            }
        }
    }

    /**
     * Port of Client-Java `createMinimap` (377).
     * Builds the 512×512 minimap raster + active mapfunction icons for `level`.
     */
    private createMinimap(level: number): void {
        if (!this.minimap) {
            return;
        }

        const pixels: Int32Array = this.minimap.data;
        const length: number = pixels.length;
        for (let i: number = 0; i < length; i++) {
            pixels[i] = 0;
        }

        for (let z: number = 1; z < BuildArea.SIZE - 1; z++) {
            let offset: number = (BuildArea.SIZE - 1 - z) * 512 * 4 + 24628;

            for (let x: number = 1; x < BuildArea.SIZE - 1; x++) {
                // Java: (levelTileFlags[level][x][z] & 0x18) == 0 → VisBelow|ForceHighDetail
                if (this.mapl && (this.mapl[level][x][z] & (MapFlag.VisBelow | MapFlag.ForceHighDetail)) === 0) {
                    this.world?.render2DGround(level, x, z, pixels, offset, 512);
                }

                if (level < 3 && this.mapl && (this.mapl[level + 1][x][z] & MapFlag.VisBelow) !== 0) {
                    this.world?.render2DGround(level + 1, x, z, pixels, offset, 512);
                }

                offset += 4;
            }
        }

        const inactiveRgb: number = ((((Math.random() * 20.0) | 0) + 238 - 10) << 16) + ((((Math.random() * 20.0) | 0) + 238 - 10) << 8) + ((Math.random() * 20.0) | 0) + 238 - 10;
        const activeRgb: number = (((Math.random() * 20.0) | 0) + 238 - 10) << 16;

        this.minimap.setPixels();

        for (let z: number = 1; z < BuildArea.SIZE - 1; z++) {
            for (let x: number = 1; x < BuildArea.SIZE - 1; x++) {
                if (this.mapl && (this.mapl[level][x][z] & (MapFlag.VisBelow | MapFlag.ForceHighDetail)) === 0) {
                    this.drawTooltip(level, x, z, inactiveRgb, activeRgb);
                }

                if (level < 3 && this.mapl && (this.mapl[level + 1][x][z] & MapFlag.VisBelow) !== 0) {
                    this.drawTooltip(level + 1, x, z, inactiveRgb, activeRgb);
                }
            }
        }

        // Java: areaViewport.bind(); Pix3D.lineOffset = areaViewportOffset;
        this.bindGameViewport();

        // Java field378++ > 177 → ANTICHEAT_CYCLELOGIC4 (173) + p3(2657152)
        // TS cyclelogic4 ≡ field378 (not cyclelogic3 — that is drawScene system-update thr 112).
        Client.cyclelogic4++;
        if (Client.cyclelogic4 > 177) {
            Client.cyclelogic4 = 0;
            this.out.p1Enc(ClientProt.ANTICHEAT_CYCLELOGIC4);
            this.out.p3(2657152);
        }

        this.activeMapFunctionCount = 0;

        for (let x: number = 0; x < BuildArea.SIZE; x++) {
            for (let z: number = 0; z < BuildArea.SIZE; z++) {
                // Java method303(currentLevel, x, z) → gdType
                const typecode: number = this.world?.gdType(this.minusedlevel, x, z) ?? 0;
                if (typecode === 0) {
                    continue;
                }

                const locId = (typecode >> 14) & 0x7fff;
                const func: number = LocType.list(locId).mapfunction;
                if (func < 0) {
                    continue;
                }

                let stx: number = x;
                let stz: number = z;

                if (func !== 22 && func !== 29 && func !== 34 && func !== 36 && func !== 46 && func !== 47 && func !== 48) {
                    const maxX: number = BuildArea.SIZE;
                    const maxZ: number = BuildArea.SIZE;
                    const collisionMap: CollisionMap | null = this.collision[this.minusedlevel];

                    if (collisionMap) {
                        const flags: Int32Array = collisionMap.flags;

                        for (let i: number = 0; i < 10; i++) {
                            const rand: number = (Math.random() * 4.0) | 0;
                            if (rand === 0 && stx > 0 && stx > x - 3 && (flags[CollisionMap.index(stx - 1, stz)] & CollisionFlag.PL_WALK_E) === CollisionFlag._OPEN) {
                                stx--;
                            }

                            if (rand === 1 && stx < maxX - 1 && stx < x + 3 && (flags[CollisionMap.index(stx + 1, stz)] & CollisionFlag.PL_WALK_W) === CollisionFlag._OPEN) {
                                stx++;
                            }

                            if (rand === 2 && stz > 0 && stz > z - 3 && (flags[CollisionMap.index(stx, stz - 1)] & CollisionFlag.PL_WALK_N) === CollisionFlag._OPEN) {
                                stz--;
                            }

                            if (rand === 3 && stz < maxZ - 1 && stz < z + 3 && (flags[CollisionMap.index(stx, stz + 1)] & CollisionFlag.PL_WALK_S) === CollisionFlag._OPEN) {
                                stz++;
                            }
                        }
                    }
                }

                this.activeMapFunctions[this.activeMapFunctionCount] = this.mapfunction[func];
                this.activeMapFunctionX[this.activeMapFunctionCount] = stx;
                this.activeMapFunctionZ[this.activeMapFunctionCount] = stz;
                this.activeMapFunctionCount++;
            }
        }
    }

    private drawTooltip(level: number, tileX: number, tileZ: number, inactiveRgb: number, activeRgb: number): void {
        if (!this.world || !this.minimap) {
            return;
        }

        const wallType: number = this.world.wallType(level, tileX, tileZ);
        if (wallType !== 0) {
            const info: number = this.world.typeCode2(level, tileX, tileZ, wallType);
            const angle: number = (info >> 6) & 0x3;
            const shape: number = info & 0x1f;
            let rgb: number = inactiveRgb;
            if (wallType > 0) {
                rgb = activeRgb;
            }

            const dst: Int32Array = this.minimap.data;
            const offset: number = tileX * 4 + (103 - tileZ) * 512 * 4 + 24624;
            const locId: number = (wallType >> 14) & 0x7fff;

            const loc: LocType = LocType.list(locId);
            if (loc.mapscene !== -1) {
                const scene: Pix8 | null = this.mapscene[loc.mapscene];
                if (scene) {
                    const offsetX: number = ((loc.width * 4 - scene.wi) / 2) | 0;
                    const offsetY: number = ((loc.length * 4 - scene.hi) / 2) | 0;
                    scene.plotSprite(tileX * 4 + 48 + offsetX, (BuildArea.SIZE - tileZ - loc.length) * 4 + offsetY + 48);
                }
            } else {
                if (shape === LocShape.WALL_STRAIGHT || shape === LocShape.WALL_L) {
                    if (angle === LocAngle.WEST) {
                        dst[offset] = rgb;
                        dst[offset + 512] = rgb;
                        dst[offset + 1024] = rgb;
                        dst[offset + 1536] = rgb;
                    } else if (angle === LocAngle.NORTH) {
                        dst[offset] = rgb;
                        dst[offset + 1] = rgb;
                        dst[offset + 2] = rgb;
                        dst[offset + 3] = rgb;
                    } else if (angle === LocAngle.EAST) {
                        dst[offset + 3] = rgb;
                        dst[offset + 3 + 512] = rgb;
                        dst[offset + 3 + 1024] = rgb;
                        dst[offset + 3 + 1536] = rgb;
                    } else if (angle === LocAngle.SOUTH) {
                        dst[offset + 1536] = rgb;
                        dst[offset + 1536 + 1] = rgb;
                        dst[offset + 1536 + 2] = rgb;
                        dst[offset + 1536 + 3] = rgb;
                    }
                }

                if (shape === LocShape.WALL_SQUARE_CORNER) {
                    if (angle === LocAngle.WEST) {
                        dst[offset] = rgb;
                    } else if (angle === LocAngle.NORTH) {
                        dst[offset + 3] = rgb;
                    } else if (angle === LocAngle.EAST) {
                        dst[offset + 3 + 1536] = rgb;
                    } else if (angle === LocAngle.SOUTH) {
                        dst[offset + 1536] = rgb;
                    }
                }

                if (shape === LocShape.WALL_L) {
                    if (angle === LocAngle.SOUTH) {
                        dst[offset] = rgb;
                        dst[offset + 512] = rgb;
                        dst[offset + 1024] = rgb;
                        dst[offset + 1536] = rgb;
                    } else if (angle === LocAngle.WEST) {
                        dst[offset] = rgb;
                        dst[offset + 1] = rgb;
                        dst[offset + 2] = rgb;
                        dst[offset + 3] = rgb;
                    } else if (angle === LocAngle.NORTH) {
                        dst[offset + 3] = rgb;
                        dst[offset + 3 + 512] = rgb;
                        dst[offset + 3 + 1024] = rgb;
                        dst[offset + 3 + 1536] = rgb;
                    } else if (angle === LocAngle.EAST) {
                        dst[offset + 1536] = rgb;
                        dst[offset + 1536 + 1] = rgb;
                        dst[offset + 1536 + 2] = rgb;
                        dst[offset + 1536 + 3] = rgb;
                    }
                }
            }
        }

        const sceneType = this.world.sceneType(level, tileX, tileZ);
        if (sceneType !== 0) {
            const info: number = this.world.typeCode2(level, tileX, tileZ, sceneType);
            const angle: number = (info >> 6) & 0x3;
            const shape: number = info & 0x1f;
            const locId: number = (sceneType >> 14) & 0x7fff;

            const loc: LocType = LocType.list(locId);
            if (loc.mapscene !== -1) {
                const scene: Pix8 | null = this.mapscene[loc.mapscene];
                if (scene) {
                    const offsetX: number = ((loc.width * 4 - scene.wi) / 2) | 0;
                    const offsetY: number = ((loc.length * 4 - scene.hi) / 2) | 0;
                    scene.plotSprite(tileX * 4 + 48 + offsetX, (BuildArea.SIZE - tileZ - loc.length) * 4 + offsetY + 48);
                }
            } else {
                if (shape === LocShape.WALL_DIAGONAL) {
                    let rgb: number = 0xeeeeee;
                    if (sceneType > 0) {
                        rgb = 0xee0000;
                    }

                    const dst: Int32Array = this.minimap.data;
                    const offset: number = tileX * 4 + (BuildArea.SIZE - 1 - tileZ) * 512 * 4 + 24624;

                    if (angle === LocAngle.WEST || angle === LocAngle.EAST) {
                        dst[offset + 1536] = rgb;
                        dst[offset + 1024 + 1] = rgb;
                        dst[offset + 512 + 2] = rgb;
                        dst[offset + 3] = rgb;
                    } else {
                        dst[offset] = rgb;
                        dst[offset + 512 + 1] = rgb;
                        dst[offset + 1024 + 2] = rgb;
                        dst[offset + 1536 + 3] = rgb;
                    }
                }
            }
        }

        const gdType = this.world.gdType(level, tileX, tileZ);
        if (gdType !== 0) {
            const locId = (gdType >> 14) & 0x7fff;

            const loc: LocType = LocType.list(locId);
            if (loc.mapscene !== -1) {
                const scene: Pix8 | null = this.mapscene[loc.mapscene];
                if (scene) {
                    const offsetX: number = ((loc.width * 4 - scene.wi) / 2) | 0;
                    const offsetY: number = ((loc.length * 4 - scene.hi) / 2) | 0;
                    scene.plotSprite(tileX * 4 + 48 + offsetX, (BuildArea.SIZE - tileZ - loc.length) * 4 + offsetY + 48);
                }
            }
        }
    }

    /**
     * Java 377 `interactWithLoc` — pathfind + cross only. Packet bodies are written by `doAction`
     * (useMenuOption): OPLOC1–5 always after the call; OPLOCT/OPLOCU only when this returns true.
     */
    private interactWithLoc(x: number, z: number, typecode: number, _opcode: number = -1): boolean {
        if (!this.localPlayer || !this.world) {
            return false;
        }

        const locId: number = (typecode >> 14) & 0x7fff;
        const info: number = this.world.typeCode2(this.minusedlevel, x, z, typecode);
        if (info === -1) {
            return false;
        }

        const shape: number = info & 0x1f;
        const angle: number = (info >> 6) & 0x3;

        // Java interactWithLoc has no cyclelogic here; ANTICHEAT_CYCLELOGIC2 (168) is field533 in drawScene redrawFrame.

        if (shape === LocShape.CENTREPIECE_STRAIGHT || shape === LocShape.CENTREPIECE_DIAGONAL || shape === LocShape.GROUND_DECOR) {
            const loc: LocType = LocType.list(locId);

            let width: number;
            let height: number;
            if (angle === LocAngle.WEST || angle === LocAngle.EAST) {
                width = loc.width;
                height = loc.length;
            } else {
                width = loc.length;
                height = loc.width;
            }

            let forceapproach: number = loc.forceapproach;
            // Java 377: (forceapproach >> (4 - angle)) + ((forceapproach << angle) & 0xF)
            if (angle !== 0) {
                forceapproach = (forceapproach >> (4 - angle)) + ((forceapproach << angle) & 0xf);
            }

            // Java 377 interactWithLoc always passes tryNearest=true (289 passed false)
            this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], x, z, true, width, height, 0, 0, forceapproach, 2);
        } else {
            this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], x, z, true, 0, 0, angle, shape + 1, 0, 2);
        }

        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        return true;
    }

    /**
     * Java: selectedArea = 2; if com.layer == viewportInterfaceId → 1; if chatInterfaceId → 3.
     * Null-safe (Java NPE if Component.get fails; we keep flash area 2).
     */
    private setSelectedAreaFromCom(comId: number): void {
        const com = IfType.get(comId);
        if (!com) {
            return;
        }
        if (com.layerId === this.mainModalId) {
            this.selectedArea = 1;
        }
        if (com.layerId === this.chatModalId) {
            this.selectedArea = 3;
        }
    }

    /** Java 377 useMenuOption OPLOC1–5 field order / alts (OpLocDecoder). */
    private writeOpLoc(opcode: number, x: number, z: number, typecode: number): void {
        const locId: number = (typecode >> 14) & 0x7fff;
        const worldX = x + this.mapBuildBaseX;
        const worldZ = z + this.mapBuildBaseZ;
        if (opcode === ClientProt.OPLOC1) {
            this.out.p1Enc(opcode);
            this.out.p2_alt2(worldX);
            this.out.p2_alt1(worldZ);
            this.out.p2_alt1(locId);
        } else if (opcode === ClientProt.OPLOC2) {
            this.out.p1Enc(opcode);
            this.out.p2(locId);
            this.out.p2(worldX);
            this.out.p2_alt2(worldZ);
        } else if (opcode === ClientProt.OPLOC3) {
            this.out.p1Enc(opcode);
            this.out.p2_alt2(worldZ);
            this.out.p2_alt1(locId);
            this.out.p2_alt3(worldX);
        } else if (opcode === ClientProt.OPLOC4) {
            this.out.p1Enc(opcode);
            this.out.p2(worldX);
            this.out.p2_alt1(worldZ);
            this.out.p2(locId);
        } else if (opcode === ClientProt.OPLOC5) {
            this.out.p1Enc(opcode);
            this.out.p2_alt1(locId);
            this.out.p2_alt1(worldZ);
            this.out.p2(worldX);
        }
    }

    private tryMove(srcX: number, srcZ: number, dx: number, dz: number, tryNearest: boolean, locWidth: number, locLength: number, locAngle: number, locShape: number, forceapproach: number, type: number): boolean {
        const collisionMap: CollisionMap | null = this.collision[this.minusedlevel];
        if (!collisionMap) {
            return false;
        }

        const sceneWidth: number = BuildArea.SIZE;
        const sceneLength: number = BuildArea.SIZE;

        for (let x: number = 0; x < sceneWidth; x++) {
            for (let z: number = 0; z < sceneLength; z++) {
                const index: number = CollisionMap.index(x, z);
                this.dirMap[index] = 0;
                this.distMap[index] = 99999999;
            }
        }

        let x: number = srcX;
        let z: number = srcZ;

        const srcIndex: number = CollisionMap.index(srcX, srcZ);
        this.dirMap[srcIndex] = 99;
        this.distMap[srcIndex] = 0;

        let steps: number = 0;
        let length: number = 0;

        this.routeX[steps] = srcX;
        this.routeZ[steps++] = srcZ;

        let arrived: boolean = false;
        let bufferSize: number = this.routeX.length;
        const flags: Int32Array = collisionMap.flags;

        while (length !== steps) {
            x = this.routeX[length];
            z = this.routeZ[length];
            length = (length + 1) % bufferSize;

            if (x === dx && z === dz) {
                arrived = true;
                break;
            }

            if (locShape !== LocShape.WALL_STRAIGHT) {
                if ((locShape < LocShape.WALLDECOR_STRAIGHT_OFFSET || locShape === LocShape.CENTREPIECE_STRAIGHT) && collisionMap.testWall(x, z, dx, dz, locShape - 1, locAngle)) {
                    arrived = true;
                    break;
                }

                if (locShape < LocShape.CENTREPIECE_STRAIGHT && collisionMap.testWDecor(x, z, dx, dz, locShape - 1, locAngle)) {
                    arrived = true;
                    break;
                }
            }

            if (locWidth !== 0 && locLength !== 0 && collisionMap.testLoc(x, z, dx, dz, locWidth, locLength, forceapproach)) {
                arrived = true;
                break;
            }

            const nextCost: number = this.distMap[CollisionMap.index(x, z)] + 1;
            let index: number = CollisionMap.index(x - 1, z);
            if (x > 0 && this.dirMap[index] === 0 && (flags[index] & CollisionFlag.PL_WALK_E) === CollisionFlag._OPEN) {
                this.routeX[steps] = x - 1;
                this.routeZ[steps] = z;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 2;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x + 1, z);
            if (x < sceneWidth - 1 && this.dirMap[index] === 0 && (flags[index] & CollisionFlag.PL_WALK_W) === CollisionFlag._OPEN) {
                this.routeX[steps] = x + 1;
                this.routeZ[steps] = z;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 8;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x, z - 1);
            if (z > 0 && this.dirMap[index] === 0 && (flags[index] & CollisionFlag.PL_WALK_N) === CollisionFlag._OPEN) {
                this.routeX[steps] = x;
                this.routeZ[steps] = z - 1;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 1;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x, z + 1);
            if (z < sceneLength - 1 && this.dirMap[index] === 0 && (flags[index] & CollisionFlag.PL_WALK_S) === CollisionFlag._OPEN) {
                this.routeX[steps] = x;
                this.routeZ[steps] = z + 1;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 4;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x - 1, z - 1);
            if (
                x > 0 &&
                z > 0 &&
                this.dirMap[index] === 0 &&
                (flags[index] & CollisionFlag.PL_WALK_NE) === 0 &&
                (flags[CollisionMap.index(x - 1, z)] & CollisionFlag.PL_WALK_E) === CollisionFlag._OPEN &&
                (flags[CollisionMap.index(x, z - 1)] & CollisionFlag.PL_WALK_N) === CollisionFlag._OPEN
            ) {
                this.routeX[steps] = x - 1;
                this.routeZ[steps] = z - 1;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 3;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x + 1, z - 1);
            if (
                x < sceneWidth - 1 &&
                z > 0 &&
                this.dirMap[index] === 0 &&
                (flags[index] & CollisionFlag.PL_WALK_NW) === 0 &&
                (flags[CollisionMap.index(x + 1, z)] & CollisionFlag.PL_WALK_W) === CollisionFlag._OPEN &&
                (flags[CollisionMap.index(x, z - 1)] & CollisionFlag.PL_WALK_N) === CollisionFlag._OPEN
            ) {
                this.routeX[steps] = x + 1;
                this.routeZ[steps] = z - 1;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 9;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x - 1, z + 1);
            if (
                x > 0 &&
                z < sceneLength - 1 &&
                this.dirMap[index] === 0 &&
                (flags[index] & CollisionFlag.PL_WALK_SE) === 0 &&
                (flags[CollisionMap.index(x - 1, z)] & CollisionFlag.PL_WALK_E) === CollisionFlag._OPEN &&
                (flags[CollisionMap.index(x, z + 1)] & CollisionFlag.PL_WALK_S) === CollisionFlag._OPEN
            ) {
                this.routeX[steps] = x - 1;
                this.routeZ[steps] = z + 1;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 6;
                this.distMap[index] = nextCost;
            }

            index = CollisionMap.index(x + 1, z + 1);
            if (
                x < sceneWidth - 1 &&
                z < sceneLength - 1 &&
                this.dirMap[index] === 0 &&
                (flags[index] & CollisionFlag.PL_WALK_SW) === 0 &&
                (flags[CollisionMap.index(x + 1, z)] & CollisionFlag.PL_WALK_W) === CollisionFlag._OPEN &&
                (flags[CollisionMap.index(x, z + 1)] & CollisionFlag.PL_WALK_S) === CollisionFlag._OPEN
            ) {
                this.routeX[steps] = x + 1;
                this.routeZ[steps] = z + 1;
                steps = (steps + 1) % bufferSize;
                this.dirMap[index] = 12;
                this.distMap[index] = nextCost;
            }
        }

        this.tryMoveNearest = 0;

        // Java 377 tryMove nearest: 10-tile window, dist² to loc bbox, cost tiebreak.
        // 289 used a 1-tile ring + min cost only — not authentic for 377.
        if (!arrived) {
            if (!tryNearest) {
                return false;
            }

            let bestDistSq: number = 1000;
            let bestCost: number = 100;
            const pad: number = 10;
            for (let px: number = dx - pad; px <= dx + pad; px++) {
                for (let pz: number = dz - pad; pz <= dz + pad; pz++) {
                    if (px < 0 || pz < 0 || px >= BuildArea.SIZE || pz >= BuildArea.SIZE) {
                        continue;
                    }
                    const cost: number = this.distMap[CollisionMap.index(px, pz)];
                    if (cost >= 100) {
                        continue;
                    }

                    let distX: number = 0;
                    if (px < dx) {
                        distX = dx - px;
                    } else if (px > locWidth + dx - 1) {
                        distX = px - (locWidth + dx - 1);
                    }

                    let distZ: number = 0;
                    if (pz < dz) {
                        distZ = dz - pz;
                    } else if (pz > dz + locLength - 1) {
                        distZ = pz - (dz + locLength - 1);
                    }

                    const distSq: number = distX * distX + distZ * distZ;
                    if (distSq < bestDistSq || (bestDistSq === distSq && cost < bestCost)) {
                        bestDistSq = distSq;
                        bestCost = cost;
                        x = px;
                        z = pz;
                    }
                }
            }

            if (bestDistSq === 1000) {
                return false;
            }
            // Java: if nearest is still the start tile, abort (no path step to send)
            if (srcX === x && srcZ === z) {
                return false;
            }
            this.tryMoveNearest = 1;
        }

        length = 0;
        this.routeX[length] = x;
        this.routeZ[length++] = z;

        let dir: number = this.dirMap[CollisionMap.index(x, z)];
        let next: number = dir;
        while (x !== srcX || z !== srcZ) {
            if (next !== dir) {
                dir = next;
                this.routeX[length] = x;
                this.routeZ[length++] = z;
            }

            if ((next & DirectionFlag.EAST) !== 0) {
                x++;
            } else if ((next & DirectionFlag.WEST) !== 0) {
                x--;
            }

            if ((next & DirectionFlag.NORTH) !== 0) {
                z++;
            } else if ((next & DirectionFlag.SOUTH) !== 0) {
                z--;
            }

            next = this.dirMap[CollisionMap.index(x, z)];
        }

        if (length > 0) {
            bufferSize = Math.min(length, 25); // max number of turns in a single pf request
            length--;

            const startX: number = this.routeX[length];
            const startZ: number = this.routeZ[length];

            // Java 377 tryMove: size then p2_alt3(x) p1(ctrl) p2_alt3(z) then p1(dx) p1_alt3(dz)
            // (289 had ctrl before coords and plain p2/p1 — engine MoveClickDecoder rejects that shape)
            if (type === 0) {
                this.out.p1Enc(ClientProt.MOVE_GAMECLICK);
                this.out.p1(bufferSize + bufferSize + 3);
            } else if (type === 1) {
                this.out.p1Enc(ClientProt.MOVE_MINIMAPCLICK);
                this.out.p1(bufferSize + bufferSize + 3 + 14);
            } else if (type === 2) {
                this.out.p1Enc(ClientProt.MOVE_OPCLICK);
                this.out.p1(bufferSize + bufferSize + 3);
            }

            this.out.p2_alt3(startX + this.mapBuildBaseX);
            this.out.p1(this.keyHeld[5] === 1 ? 1 : 0);
            this.out.p2_alt3(startZ + this.mapBuildBaseZ);

            this.minimapFlagX = this.routeX[0];
            this.minimapFlagZ = this.routeZ[0];

            for (let i: number = 1; i < bufferSize; i++) {
                length--;
                this.out.p1(this.routeX[length] - startX);
                this.out.p1_alt3(this.routeZ[length] - startZ);
            }

            return true;
        }

        return type !== 1;
    }

    private async readPacket(): Promise<boolean> {
        if (!this.stream) {
            return false;
        }

        try {
            let available: number = this.stream.available;
            if (available === 0) {
                return false;
            }

            if (this.ptype === -1) {
                await this.stream.readBytes(this.in.data, 0, 1);
                this.ptype = this.in.data[0] & 0xff;
                if (this.randomIn) {
                    this.ptype = (this.ptype - this.randomIn.nextInt) & 0xff;
                }
                this.psize = ServerProtSizes[this.ptype];
                available--;
            }

            if (this.psize === -1) {
                if (available <= 0) {
                    return false;
                }

                await this.stream.readBytes(this.in.data, 0, 1);
                this.psize = this.in.data[0] & 0xff;
                available--;
            }

            if (this.psize === -2) {
                if (available <= 1) {
                    return false;
                }

                await this.stream.readBytes(this.in.data, 0, 2);
                this.in.pos = 0;
                this.psize = this.in.g2();
                available -= 2;
            }

            if (available < this.psize) {
                return false;
            }

            this.in.pos = 0;
            await this.stream.readBytes(this.in.data, 0, this.psize);

            this.timeoutTimer = performance.now();
            this.ptype2 = this.ptype1;
            this.ptype1 = this.ptype0;
            this.ptype0 = this.ptype;

            if (this.ptype === ServerProt.IF_OPENCHAT) {
                // Java ptype 109: g2; unload side/fullscreen/main; set chat if different
                const comId: number = this.in.g2();
                this.resetInterfaceAnimation(comId);

                if (this.sideModalId !== -1) {
                    this.unloadCom(this.sideModalId);
                    this.sideModalId = -1;
                    this.redrawSide = true;
                    this.redrawIcons = true;
                }
                if (this.fullscreenInterfaceId0 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId0);
                    this.fullscreenInterfaceId0 = -1;
                    this.redrawFrame = true;
                }
                if (this.fullscreenInterfaceId1 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId1);
                    this.fullscreenInterfaceId1 = -1;
                }
                if (this.mainModalId !== -1) {
                    this.unloadCom(this.mainModalId);
                    this.mainModalId = -1;
                }
                if (this.chatModalId !== comId) {
                    this.unloadCom(this.chatModalId);
                    this.chatModalId = comId;
                }
                this.resumedPauseButton = false;
                this.redrawChat = true;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_OPENMAIN_SIDE) {
                // 377 Java: g2_alt2(main), g2_alt3(side) + unloadCom on change
                const mainComId: number = this.in.g2_alt2();
                const sideComId: number = this.in.g2_alt3();

                if (this.chatModalId !== -1) {
                    this.unloadCom(this.chatModalId);
                    this.chatModalId = -1;
                    this.redrawChat = true;
                }
                if (this.fullscreenInterfaceId0 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId0);
                    this.fullscreenInterfaceId0 = -1;
                    this.redrawFrame = true;
                }
                if (this.fullscreenInterfaceId1 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId1);
                    this.fullscreenInterfaceId1 = -1;
                }
                if (this.mainModalId !== mainComId) {
                    this.unloadCom(this.mainModalId);
                    this.mainModalId = mainComId;
                }
                if (this.sideModalId !== sideComId) {
                    this.unloadCom(this.sideModalId);
                    this.sideModalId = sideComId;
                }

                // Java: if (chatbackInputOpen != 0) { chatbackInputOpen = 0; redrawChatback = true; }
                if (this.dialogInputOpen || this.chatbackInputOpen !== 0) {
                    this.dialogInputOpen = false;
                    this.chatbackInputOpen = 0;
                    this.redrawChat = true;
                }

                this.redrawSide = true;
                this.redrawIcons = true;
                this.resumedPauseButton = false;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_CLOSE) {
                // Java ptype 29: unloadCom all open interfaces
                if (this.sideModalId !== -1) {
                    this.unloadCom(this.sideModalId);
                    this.sideModalId = -1;
                    this.redrawSide = true;
                    this.redrawIcons = true;
                }

                if (this.chatModalId !== -1) {
                    this.unloadCom(this.chatModalId);
                    this.chatModalId = -1;
                    this.redrawChat = true;
                }

                if (this.fullscreenInterfaceId0 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId0);
                    this.fullscreenInterfaceId0 = -1;
                    this.redrawFrame = true;
                }
                if (this.fullscreenInterfaceId1 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId1);
                    this.fullscreenInterfaceId1 = -1;
                }

                if (this.mainModalId !== -1) {
                    this.unloadCom(this.mainModalId);
                    this.mainModalId = -1;
                }

                // Java: if (chatbackInputOpen != 0) { chatbackInputOpen = 0; redrawChatback = true; }
                if (this.dialogInputOpen || this.chatbackInputOpen !== 0) {
                    this.dialogInputOpen = false;
                    this.chatbackInputOpen = 0;
                    this.redrawChat = true;
                }

                this.resumedPauseButton = false;

                this.ptype = -1;
                return true;
            }

            // 377 IF_SETTAB (Java ptype 10): g1_alt3(tab) + g2_alt2(component); 65535→-1
            // Java: if (tabInterfaceId[tab] != com) { unloadCom(old); tabInterfaceId[tab] = com; }
            // sideIcon[] ≡ Java tabInterfaceId[15]
            if (this.ptype === ServerProt.IF_SETICON || this.ptype === ServerProt.IF_SETTAB) {
                const tab: number = this.in.g1_alt3();
                let comId: number = this.in.g2_alt2();
                if (comId === 65535) {
                    comId = -1;
                }
                // Java indexes without a range check; guard OOR so a bad tab cannot throw mid-stream.
                if (tab >= 0 && tab < this.sideIcon.length) {
                    if (this.sideIcon[tab] !== comId) {
                        this.unloadCom(this.sideIcon[tab]);
                        this.sideIcon[tab] = comId;
                    }
                }

                this.redrawSide = true;
                this.redrawIcons = true;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_OPENMAIN) {
                // 377 Java: g2_alt3(component) + unloadCom on change
                const comId: number = this.in.g2_alt3();
                this.resetInterfaceAnimation(comId);

                if (this.sideModalId !== -1) {
                    this.unloadCom(this.sideModalId);
                    this.sideModalId = -1;
                    this.redrawSide = true;
                    this.redrawIcons = true;
                }

                if (this.chatModalId !== -1) {
                    this.unloadCom(this.chatModalId);
                    this.chatModalId = -1;
                    this.redrawChat = true;
                }

                if (this.fullscreenInterfaceId0 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId0);
                    this.fullscreenInterfaceId0 = -1;
                    this.redrawFrame = true;
                }
                if (this.fullscreenInterfaceId1 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId1);
                    this.fullscreenInterfaceId1 = -1;
                }

                if (this.mainModalId !== comId) {
                    this.unloadCom(this.mainModalId);
                    this.mainModalId = comId;
                }

                // Java: if (chatbackInputOpen != 0) { chatbackInputOpen = 0; redrawChatback = true; }
                if (this.dialogInputOpen || this.chatbackInputOpen !== 0) {
                    this.dialogInputOpen = false;
                    this.chatbackInputOpen = 0;
                    this.redrawChat = true;
                }

                this.resumedPauseButton = false;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_OPENSIDE) {
                // 377 Java: g2_alt3(component) + unloadCom on change
                const comId: number = this.in.g2_alt3();
                this.resetInterfaceAnimation(comId);

                if (this.chatModalId !== -1) {
                    this.unloadCom(this.chatModalId);
                    this.chatModalId = -1;
                    this.redrawChat = true;
                }

                if (this.fullscreenInterfaceId0 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId0);
                    this.fullscreenInterfaceId0 = -1;
                    this.redrawFrame = true;
                }
                if (this.fullscreenInterfaceId1 !== -1) {
                    this.unloadCom(this.fullscreenInterfaceId1);
                    this.fullscreenInterfaceId1 = -1;
                }

                if (this.mainModalId !== -1) {
                    this.unloadCom(this.mainModalId);
                    this.mainModalId = -1;
                }

                if (this.sideModalId !== comId) {
                    this.unloadCom(this.sideModalId);
                    this.sideModalId = comId;
                }

                // Java: if (chatbackInputOpen != 0) { chatbackInputOpen = 0; redrawChatback = true; }
                if (this.dialogInputOpen || this.chatbackInputOpen !== 0) {
                    this.dialogInputOpen = false;
                    this.chatbackInputOpen = 0;
                    this.redrawChat = true;
                }

                this.redrawSide = true;
                this.redrawIcons = true;
                this.resumedPauseButton = false;

                this.ptype = -1;
                return true;
            }

            // 377 IF_SETTAB_ACTIVE: p1_alt2(tab)
            if (this.ptype === ServerProt.IF_SHOWICON || this.ptype === ServerProt.IF_SETTAB_ACTIVE) {
                this.activeIcon = this.in.g1_alt2();

                this.redrawSide = true;
                this.redrawIcons = true;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_OPENOVERLAY) {
                // Java ptype 50: g2b; if >=0 reset anim; unload if different
                const comId: number = this.in.g2b();
                if (comId >= 0) {
                    this.resetInterfaceAnimation(comId);
                }
                if (this.mainOverlayId !== comId) {
                    this.unloadCom(this.mainOverlayId);
                    this.mainOverlayId = comId;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETCOLOUR) {
                // 377 Java: g2(com), g2_alt2(colour)
                const comId: number = this.in.g2();
                const colour: number = this.in.g2_alt2();

                const r: number = (colour >> 10) & 0x1f;
                const g: number = (colour >> 5) & 0x1f;
                const b: number = colour & 0x1f;
                IfType.get(comId)!.colour = (r << 19) + (g << 11) + (b << 3);

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETHIDE) {
                // 377 Java: g1(hide), g2(com)
                const hide = this.in.g1() === 1;
                const comId: number = this.in.g2();

                IfType.get(comId)!.hide = hide;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETOBJECT) {
                // 377 Java: g2(zoom), g2_alt1(obj), g2_alt3(com)
                const zoom: number = this.in.g2();
                const objId: number = this.in.g2_alt1();
                const comId: number = this.in.g2_alt3();

                if (objId === 65535) {
                    IfType.get(comId)!.model1Type = 0;
                    this.ptype = -1;
                    return true;
                }

                const type: ObjType = ObjType.list(objId);
                IfType.get(comId)!.model1Type = 4;
                IfType.get(comId)!.model1Id = objId;
                IfType.get(comId)!.modelXAn = type.xan2d;
                IfType.get(comId)!.modelYAn = type.yan2d;
                IfType.get(comId)!.modelZoom = ((type.zoom2d * 100) / zoom) | 0;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETMODEL) {
                // 377 Java: g2_alt3(model), g2_alt3(com)
                const modelId: number = this.in.g2_alt3();
                const comId: number = this.in.g2_alt3();

                IfType.get(comId)!.model1Type = 1;
                IfType.get(comId)!.model1Id = modelId;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETANIM) {
                // 377 Java: g2_alt3(com), g2b_alt2(seq)
                const comId: number = this.in.g2_alt3();
                const seqId: number = this.in.g2b_alt2();

                const com = IfType.get(comId);
                if (com && (com.modelAnim !== seqId || seqId === -1)) {
                    com.modelAnim = seqId;
                    com.animFrame = 0;
                    com.animCycle = 0;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETPLAYERHEAD) {
                // 377 Java: g2_alt3(com)
                const comId = this.in.g2_alt3();

                if (this.localPlayer) {
                    IfType.get(comId)!.model1Type = 3;
                    if (!this.localPlayer.transmog) {
                        // Java: (app[11]<<5)+(app[8]<<10)+(app[0]<<15)+(col[0]<<25)+(col[4]<<20)+app[1]
                        IfType.get(comId)!.model1Id =
                            (this.localPlayer.appearance[11] << 5) +
                            (this.localPlayer.appearance[8] << 10) +
                            (this.localPlayer.appearance[0] << 15) +
                            (this.localPlayer.colour[0] << 25) +
                            (this.localPlayer.colour[4] << 20) +
                            this.localPlayer.appearance[1];
                    } else {
                        IfType.get(comId)!.model1Id = (this.localPlayer.transmog.id + 305419896) | 0;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETTEXT) {
                // 377: g2_alt3(com), gjstr(text)
                const comId: number = this.in.g2_alt3();
                const text = this.in.gjstr();

                const com = IfType.get(comId);
                if (com) {
                    com.text = text;

                    // Java only flags sidebar redraw; chat mesbox needs redrawChat too
                    // (open-then-settext after IF_OPENCHAT must repaint chatback).
                    if (com.layerId === this.sideIcon[this.activeIcon]) {
                        this.redrawSide = true;
                    }
                    if (
                        com.layerId === this.chatModalId ||
                        this.chatModalId === comId ||
                        com.layerId === this.tutComId ||
                        this.tutComId === comId
                    ) {
                        this.redrawChat = true;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETNPCHEAD) {
                // 377 Java: g2_alt2(npc), g2_alt1(com)
                const npcId: number = this.in.g2_alt2();
                const comId: number = this.in.g2_alt1();

                IfType.get(comId)!.model1Type = 2;
                IfType.get(comId)!.model1Id = npcId;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETPOSITION) {
                // 377 Java: g2b_alt1(y), g2b_alt1(x), g2(com)
                const y: number = this.in.g2b_alt1();
                const x: number = this.in.g2b_alt1();
                const comId: number = this.in.g2();

                const com = IfType.get(comId);
                if (com) {
                    com.x = x;
                    com.y = y;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETSCROLLPOS) {
                // 377 Java: g2(com), g2_alt3(pos)
                const comId: number = this.in.g2();
                let pos: number = this.in.g2_alt3();

                const com = IfType.get(comId);
                if (com && com.type === ComponentType.TYPE_LAYER) {
                    if (pos < 0) {
                        pos = 0;
                    }

                    if (pos > com.scrollHeight - com.height) {
                        pos = com.scrollHeight - com.height;
                    }

                    com.scrollPos = pos;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.TUT_FLASH) {
                this.tutFlashIcon = this.in.g1();

                if (this.tutFlashIcon === this.activeIcon) {
                    if (this.tutFlashIcon === 3) {
                        this.activeIcon = 1;
                    } else {
                        this.activeIcon = 3;
                    }

                    this.redrawSide = true;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.TUT_OPEN) {
                // 377 Java ptype 158 TUT_OPEN → stickyChatInterfaceId (TS tutComId)
                // g2b_alt1 so 65535/-1 clears sticky; unload only when id changes (Java).
                // Does NOT clear chatModalId; IF_OPEN* / IF_CLOSE do not clear sticky either.
                const comId: number = this.in.g2b_alt1();
                if (this.tutComId !== comId) {
                    this.unloadCom(this.tutComId);
                    this.tutComId = comId;
                }
                this.redrawChat = true;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_INV_STOP_TRANSMIT) {
                // 377 Java: g2_alt1(com); zero inv slots (sic redundant -1 then 0)
                const comId = this.in.g2_alt1();
                const inv = IfType.get(comId);

                if (inv?.linkObjType) {
                    for (let i: number = 0; i < inv.linkObjType.length; i++) {
                        inv.linkObjType[i] = -1;
                        inv.linkObjType[i] = 0;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_INV_FULL) {
                // 377 Java ptype 206 / UpdateInvFullEncoder:
                //   g2(com), g2(size); then size × { g2_alt3(objId+1), g1_alt2(count) | 255→g4_alt1 }
                //   trailing slots zeroed. linkObjType holds id+1 (0 = empty).
                this.redrawSide = true;

                const comId: number = this.in.g2();
                const inv = IfType.get(comId);

                if (!inv || !inv.linkObjType || !inv.linkObjNumber) {
                    // Java NPEs; consume remainder so stream stays aligned.
                    this.in.pos = this.psize;
                    this.ptype = -1;
                    return true;
                }

                const size: number = this.in.g2();
                for (let i: number = 0; i < size; i++) {
                    inv.linkObjType[i] = this.in.g2_alt3();

                    let count: number = this.in.g1_alt2();
                    if (count === 255) {
                        count = this.in.g4_alt1();
                    }

                    inv.linkObjNumber[i] = count;
                }

                for (let i: number = size; i < inv.linkObjType.length; i++) {
                    inv.linkObjType[i] = 0;
                    inv.linkObjNumber[i] = 0;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_INV_PARTIAL) {
                // 377 Java ptype 134 / UpdateInvPartialEncoder:
                //   g2(com); while pos < psize: gsmarts(slot), g2(id+1 or 0), g1(count)|255→g4
                // TS gsmart ≡ Java gsmarts (unsigned; names inverted vs 289 Packet).
                this.redrawSide = true;

                const comId: number = this.in.g2();
                const inv = IfType.get(comId);

                if (!inv || !inv.linkObjType || !inv.linkObjNumber) {
                    this.in.pos = this.psize;
                    this.ptype = -1;
                    return true;
                }

                while (this.in.pos < this.psize) {
                    const slot: number = this.in.gsmart();
                    const id: number = this.in.g2();

                    let count: number = this.in.g1();
                    if (count === 255) {
                        count = this.in.g4();
                    }

                    if (slot >= 0 && slot < inv.linkObjType.length) {
                        inv.linkObjType[slot] = id;
                        inv.linkObjNumber[slot] = count;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.CAM_LOOKAT) {
                this.cinemaCam = true;

                this.camLookAtLx = this.in.g1();
                this.camLookAtLz = this.in.g1();
                this.camLookAtHei = this.in.g2();
                this.camLookAtRate = this.in.g1();
                this.camLookAtRate2 = this.in.g1();

                if (this.camLookAtRate2 >= 100) {
                    const sceneX: number = this.camLookAtLx * 128 + 64;
                    const sceneZ: number = this.camLookAtLz * 128 + 64;
                    const sceneY: number = this.getHeightmapY(sceneX, sceneZ, this.minusedlevel) - this.camLookAtHei;

                    const deltaX: number = sceneX - this.camX;
                    const deltaY: number = sceneY - this.camY;
                    const deltaZ: number = sceneZ - this.camZ;

                    const distance: number = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) | 0;

                    this.camPitch = ((Math.atan2(deltaY, distance) * 325.949) | 0) & 0x7ff;
                    this.camYaw = ((Math.atan2(deltaX, deltaZ) * -325.949) | 0) & 0x7ff;

                    if (this.camPitch < 128) {
                        this.camPitch = 128;
                    } else if (this.camPitch > 383) {
                        this.camPitch = 383;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.CAM_SHAKE) {
                const axis: number = this.in.g1();
                const ran: number = this.in.g1();
                const amp: number = this.in.g1();
                const rate: number = this.in.g1();

                this.camShake[axis] = true;
                this.camShakeAxis[axis] = ran;
                this.camShakeRan[axis] = amp;
                this.camShakeAmp[axis] = rate;
                this.camShakeCycle[axis] = 0;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.CAM_MOVETO) {
                this.cinemaCam = true;

                this.camMoveToLx = this.in.g1();
                this.camMoveToLz = this.in.g1();
                this.camMoveToHei = this.in.g2();
                this.camMoveToRate = this.in.g1();
                this.camMoveToRate2 = this.in.g1();

                if (this.camMoveToRate2 >= 100) {
                    this.camX = this.camMoveToLx * 128 + 64;
                    this.camZ = this.camMoveToLz * 128 + 64;
                    this.camY = this.getHeightmapY(this.camX, this.camZ, this.minusedlevel) - this.camMoveToHei;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.CAM_RESET) {
                this.cinemaCam = false;

                for (let i: number = 0; i < 5; i++) {
                    this.camShake[i] = false;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.NPC_INFO) {
                this.getNpcPos(this.in, this.psize);

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.PLAYER_INFO) {
                // Java ptype 90: getPlayerPos(psize, in); awaitingSync = false
                this.getPlayerPos(this.in, this.psize);
                this.awaitingPlayerInfo = false;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.MESSAGE_GAME) {
                const message: string = this.in.gjstr();

                if (message.endsWith(':tradereq:')) {
                    const player: string = message.substring(0, message.indexOf(':'));
                    const username = JString.toUserhash(player);

                    let ignored: boolean = false;
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreUserhash[i] === username) {
                            ignored = true;
                            break;
                        }
                    }

                    if (!ignored && this.chatDisabled === 0) {
                        this.addMessage(player, 'wishes to trade with you.', 4);
                    }
                } else if (message.endsWith(':duelreq:')) {
                    const player: string = message.substring(0, message.indexOf(':'));
                    const username = JString.toUserhash(player);

                    let ignored: boolean = false;
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreUserhash[i] === username) {
                            ignored = true;
                            break;
                        }
                    }

                    if (!ignored && this.chatDisabled === 0) {
                        this.addMessage(player, 'wishes to duel with you.', 8);
                    }
                } else if (message.endsWith(':chalreq:')) {
                    // 377 Java: challenge request with custom body text
                    const player: string = message.substring(0, message.indexOf(':'));
                    const username = JString.toUserhash(player);

                    let ignored: boolean = false;
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreUserhash[i] === username) {
                            ignored = true;
                            break;
                        }
                    }

                    if (!ignored && this.chatDisabled === 0) {
                        const body: string = message.substring(message.indexOf(':') + 1, message.length - 9);
                        this.addMessage(player, body, 8);
                    }
                } else {
                    this.addMessage('', message, 0);
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_IGNORELIST) {
                this.ignoreCount = (this.psize / 8) | 0;
                for (let i: number = 0; i < this.ignoreCount; i++) {
                    this.ignoreUserhash[i] = this.in.g8();
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.CHAT_FILTER_SETTINGS) {
                this.chatPublicMode = this.in.g1();
                this.chatPrivateMode = this.in.g1();
                this.chatTradeMode = this.in.g1();

                this.redrawChatMode = true;
                this.redrawChat = true;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.MESSAGE_PRIVATE) {
                const from: bigint = this.in.g8();
                const messageId: number = this.in.g4();
                const staffModLevel: number = this.in.g1();

                let ignored: boolean = false;
                for (let i: number = 0; i < 100; i++) {
                    if (this.privateMessageIds[i] === messageId) {
                        ignored = true;
                        break;
                    }
                }

                if (staffModLevel <= 1) {
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreUserhash[i] === from) {
                            ignored = true;
                            break;
                        }
                    }
                }

                if (!ignored && this.chatDisabled === 0) {
                    try {
                        this.privateMessageIds[this.privateMessageCount] = messageId;
                        this.privateMessageCount = (this.privateMessageCount + 1) % 100;

                        // 377 Java: filter only when staffModLevel != 3
                        let text: string = WordPack.unpack(this.in, this.psize - 13);
                        if (staffModLevel !== 3) {
                            text = WordFilter.filter(text);
                        }

                        if (staffModLevel === 2 || staffModLevel === 3) {
                            this.addMessage('@cr2@' + JString.toScreenName(JString.toRawUsername(from)), text, 7);
                        } else if (staffModLevel === 1) {
                            this.addMessage('@cr1@' + JString.toScreenName(JString.toRawUsername(from)), text, 7);
                        } else {
                            this.addMessage(JString.toScreenName(JString.toRawUsername(from)), text, 3);
                        }
                    } catch (_e) {
                        // signlink.reporterror('cde1'); TODO?
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.FRIENDLIST_LOADED) {
                this.friendServerStatus = this.in.g1();
                this.redrawSide = true;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_FRIENDLIST) {
                const username: bigint = this.in.g8();
                const world: number = this.in.g1();

                let displayName: string | null = JString.toScreenName(JString.toRawUsername(username));
                for (let i: number = 0; i < this.friendCount; i++) {
                    if (username === this.friendUserhash[i]) {
                        if (this.friendNodeId[i] !== world) {
                            this.friendNodeId[i] = world;
                            this.redrawSide = true;
                            if (world > 0) {
                                this.addMessage('', displayName + ' has logged in.', 5);
                            }
                            if (world === 0) {
                                this.addMessage('', displayName + ' has logged out.', 5);
                            }
                        }

                        displayName = null;
                        break;
                    }
                }

                if (displayName && this.friendCount < 200) {
                    this.friendUserhash[this.friendCount] = username;
                    this.friendUsername[this.friendCount] = displayName;
                    this.friendNodeId[this.friendCount] = world;
                    this.friendCount++;
                    this.redrawSide = true;
                }

                let sorted: boolean = false;
                while (!sorted) {
                    sorted = true;

                    for (let i: number = 0; i < this.friendCount - 1; i++) {
                        if ((this.friendNodeId[i] !== Client.nodeId && this.friendNodeId[i + 1] === Client.nodeId) || (this.friendNodeId[i] === 0 && this.friendNodeId[i + 1] !== 0)) {
                            const oldWorld: number = this.friendNodeId[i];
                            this.friendNodeId[i] = this.friendNodeId[i + 1];
                            this.friendNodeId[i + 1] = oldWorld;

                            const oldName: string | null = this.friendUsername[i];
                            this.friendUsername[i] = this.friendUsername[i + 1];
                            this.friendUsername[i + 1] = oldName;

                            const oldUserhash: bigint = this.friendUserhash[i];
                            this.friendUserhash[i] = this.friendUserhash[i + 1];
                            this.friendUserhash[i + 1] = oldUserhash;
                            this.redrawSide = true;
                            sorted = false;
                        }
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UNSET_MAP_FLAG) {
                this.minimapFlagX = 0;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_RUNWEIGHT) {
                if (this.activeIcon === 12) {
                    this.redrawSide = true;
                }

                this.runweight = this.in.g2b();

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.HINT_ARROW) {
                this.hintType = this.in.g1();

                if (this.hintType === 1) {
                    this.hintNpc = this.in.g2();
                }

                if (this.hintType >= 2 && this.hintType <= 6) {
                    if (this.hintType === 2) {
                        this.hintOffsetX = 64;
                        this.hintOffsetZ = 64;
                    } else if (this.hintType === 3) {
                        this.hintOffsetX = 0;
                        this.hintOffsetZ = 64;
                    } else if (this.hintType === 4) {
                        this.hintOffsetX = 128;
                        this.hintOffsetZ = 64;
                    } else if (this.hintType === 5) {
                        this.hintOffsetX = 64;
                        this.hintOffsetZ = 0;
                    } else if (this.hintType === 6) {
                        this.hintOffsetX = 64;
                        this.hintOffsetZ = 128;
                    }

                    this.hintType = 2;
                    this.hintTileX = this.in.g2();
                    this.hintTileZ = this.in.g2();
                    this.hintHeight = this.in.g1();
                }

                if (this.hintType === 10) {
                    this.hintPlayer = this.in.g2();
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_REBOOT_TIMER) {
                // 377 Java: g2_alt1 * 30
                this.rebootTimer = this.in.g2_alt1() * 30;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_STAT) {
                // 377 Java: g1_alt2(stat), g1(level), g4(xp)
                this.redrawSide = true;

                const stat: number = this.in.g1_alt2();
                const level: number = this.in.g1();
                const xp: number = this.in.g4();

                this.statXP[stat] = xp;
                this.statEffectiveLevel[stat] = level;
                this.statBaseLevel[stat] = 1;

                for (let i: number = 0; i < 98; i++) {
                    if (xp >= Client.levelExperience[i]) {
                        this.statBaseLevel[stat] = i + 2;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_RUNENERGY) {
                if (this.activeIcon === 12) {
                    this.redrawSide = true;
                }

                this.runenergy = this.in.g1();

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.RESET_ANIMS) {
                for (let i: number = 0; i < this.players.length; i++) {
                    const player: ClientPlayer | null = this.players[i];
                    if (!player) {
                        continue;
                    }

                    player.primaryAnim = -1;
                }

                for (let i: number = 0; i < this.npc.length; i++) {
                    const npc: ClientNpc | null = this.npc[i];
                    if (!npc) {
                        continue;
                    }

                    npc.primaryAnim = -1;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_PID) {
                // 377 Java: members = g1(), localPid = g2_alt1()
                this.membersAccount = this.in.g1();
                this.selfSlot = this.in.g2_alt1();

                this.ptype = -1;
                return true;
            }

            // 377 LAST_LOGIN_INFO (23 bytes) — match Client-Java / LastLoginInfoEncoder
            // Java only stores fields + DNS; welcome UI is opened by server via IF_OPENFULL (login.rs2).
            if (this.ptype === ServerProt.LAST_LOGIN_INFO) {
                this.daysSincePasswordChanged = this.in.g2_alt1();
                this.in.g2_alt3(); // unused (Java field371)
                this.in.g2(); // unused
                this.in.g2(); // unused (Java field504)
                this.currentDay = this.in.g2_alt1();
                this.unreadMessages = this.in.g2_alt2();
                this.previousLoginDay = this.in.g2_alt2();
                this.daysOfMembersRemaining = this.in.g2();
                this.lastAddress = this.in.g4_alt1();
                this.recoveriesLastChangedDay = this.in.g2_alt3();
                this.in.g1_alt1(); // unused

                // Derived deltas for display / any 289-era clientCode remnants
                this.daysSinceLastLogin = this.currentDay - this.previousLoginDay;
                this.daysSinceRecoveriesChanged = this.recoveriesLastChangedDay;
                this.warnMembersInNonMembers = 0;

                this.dnsReq = null;
                if (this.lastAddress !== 0) {
                    const ipStr = JString.formatIPv4(this.lastAddress >>> 0);
                    if (!ipStr.startsWith('127.')) {
                        reverseDnsLookup(ipStr).then(results => {
                            this.dnsReq = results[0];
                        });
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.LOGOUT) {
                await this.logout();

                this.ptype = -1;
                return false;
            }

            if (this.ptype === ServerProt.P_COUNTDIALOG) {
                // Java ptype 58: showSocialInput=false; chatbackInputOpen=1; chatbackInput=""
                this.socialInputOpen = false;
                this.chatbackInputOpen = 1;
                this.dialogInputOpen = true;
                this.dialogInput = '';
                this.redrawChat = true;

                if (this.isMobile) {
                    MobileKeyboard.show();
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.SET_MULTIWAY) {
                this.inMultizone = this.in.g1();

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.SET_PLAYER_OP) {
                // 377 Java: g1_alt2(index), gjstr(op), g1(primary)
                const index = this.in.g1_alt2();
                let op: string | null = this.in.gjstr();
                const priority = this.in.g1();

                if (index >= 1 && index <= 5) {
                    if (op.toLowerCase() === 'null') {
                        op = null;
                    }

                    this.playerOp[index - 1] = op;
                    this.playerOpPriority[index - 1] = priority === 0;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.MINIMAP_TOGGLE) {
                this.minimapState = this.in.g1();

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.REBUILD_NORMAL || this.ptype === ServerProt.REBUILD_REGION) {
                // Java Client ptype 222 | 53 shared path (~8087–8303)
                // Save previous centre zones for same-centre early-out
                // (unused after early-out but matches Java var113/var114 seed pattern)
                let zoneX: number = this.mapBuildCentreZoneX;
                let zoneZ: number = this.mapBuildCentreZoneZ;

                if (this.ptype === ServerProt.REBUILD_NORMAL) {
                    // REBUILD_NORMAL: zoneZ = g2(), zoneX = g2_alt3()
                    zoneZ = this.in.g2();
                    zoneX = this.in.g2_alt3();
                    this.sceneInstanced = false;
                }

                if (this.ptype === ServerProt.REBUILD_REGION) {
                    // REBUILD_REGION: zoneX = g2_alt2(); bitfield 4×13×13; zoneZ = g2_alt2()
                    zoneX = this.in.g2_alt2();
                    this.in.gBitStart();
                    for (let level: number = 0; level < 4; level++) {
                        for (let y: number = 0; y < 13; y++) {
                            for (let x: number = 0; x < 13; x++) {
                                if (this.in.gBit(1) === 1) {
                                    this.sceneMapRegion[level][y][x] = this.in.gBit(26);
                                } else {
                                    this.sceneMapRegion[level][y][x] = -1;
                                }
                            }
                        }
                    }
                    this.in.gBitEnd();
                    zoneZ = this.in.g2_alt2();
                    this.sceneInstanced = true;
                }

                if (this.mapBuildCentreZoneX === zoneX && this.mapBuildCentreZoneZ === zoneZ && this.sceneState === 2) {
                    this.ptype = -1;
                    return true;
                }

                this.mapBuildCentreZoneX = zoneX;
                this.mapBuildCentreZoneZ = zoneZ;
                this.mapBuildBaseX = (this.mapBuildCentreZoneX - 6) * 8;
                this.mapBuildBaseZ = (this.mapBuildCentreZoneZ - 6) * 8;

                // Java int division: sceneCenterZoneX / 8. JS `/` is float — 386/8=48.25 ≠ 48.
                // Without truncating, withinTutorialIsland never arms → client requests ghost land
                // squares Java skips → missingLand>0 + onDemandRem=0 → permanent sceneState=1.
                this.withinTutorialIsland = false;
                const centreMapX = (this.mapBuildCentreZoneX / 8) | 0;
                const centreMapZ = (this.mapBuildCentreZoneZ / 8) | 0;
                if ((centreMapX === 48 || centreMapX === 49) && centreMapZ === 48) {
                    this.withinTutorialIsland = true;
                }
                if (centreMapX === 48 && centreMapZ === 148) {
                    this.withinTutorialIsland = true;
                }

                this.sceneState = 1;
                this.sceneLoadStartTime = performance.now();

                this.areaGame?.setPixels();
                this.p12?.centreString('Loading - please wait.', 257, 151, Colour.BLACK);
                this.p12?.centreString('Loading - please wait.', 256, 150, Colour.WHITE);
                this.areaGame?.draw(4, 4);

                if (this.ptype === ServerProt.REBUILD_NORMAL) {
                    let regions = 0;
                    for (let x = ((this.mapBuildCentreZoneX - 6) / 8) | 0; x <= (((this.mapBuildCentreZoneX + 6) / 8) | 0); x++) {
                        for (let z = ((this.mapBuildCentreZoneZ - 6) / 8) | 0; z <= (((this.mapBuildCentreZoneZ + 6) / 8) | 0); z++) {
                            regions++;
                        }
                    }

                    this.mapBuildGroundData = new TypedArray1d(regions, null);
                    this.mapBuildLocationData = new TypedArray1d(regions, null);
                    this.mapBuildIndex = new Int32Array(regions);
                    this.mapBuildGroundFile = new Array(regions);
                    this.mapBuildLocationFile = new Array(regions);

                    let mapCount = 0;
                    for (let x = ((this.mapBuildCentreZoneX - 6) / 8) | 0; x <= (((this.mapBuildCentreZoneX + 6) / 8) | 0); x++) {
                        for (let z = ((this.mapBuildCentreZoneZ - 6) / 8) | 0; z <= (((this.mapBuildCentreZoneZ + 6) / 8) | 0); z++) {
                            this.mapBuildIndex[mapCount] = (x << 8) + z;

                            if (this.withinTutorialIsland && (z == 49 || z == 149 || z == 147 || x == 50 || (x == 49 && z == 47))) {
                                this.mapBuildGroundFile[mapCount] = -1;
                                this.mapBuildLocationFile[mapCount] = -1;
                                mapCount++;
                            } else if (this.onDemand) {
                                const landFile = (this.mapBuildGroundFile[mapCount] = this.onDemand.getMapFile(x, z, 0));
                                if (landFile != -1) {
                                    this.onDemand.request(3, landFile);
                                }

                                const locFile = (this.mapBuildLocationFile[mapCount] = this.onDemand.getMapFile(x, z, 1));
                                if (locFile != -1) {
                                    this.onDemand.request(3, locFile);
                                }

                                mapCount++;
                            }
                        }
                    }
                }

                if (this.ptype === ServerProt.REBUILD_REGION) {
                    // Collect unique (mx<<8|mz) from sceneMapRegion entries
                    let mapCount = 0;
                    const uniqueMaps: number[] = new Array(676);
                    for (let level: number = 0; level < 4; level++) {
                        for (let y: number = 0; y < 13; y++) {
                            for (let x: number = 0; x < 13; x++) {
                                const key: number = this.sceneMapRegion[level][y][x];
                                if (key !== -1) {
                                    const mapX: number = (key >> 14) & 0x3ff;
                                    const mapZ: number = (key >> 3) & 0x7ff;
                                    let mapKey: number = (((mapX / 8) | 0) << 8) + ((mapZ / 8) | 0);
                                    for (let i: number = 0; i < mapCount; i++) {
                                        if (uniqueMaps[i] === mapKey) {
                                            mapKey = -1;
                                            break;
                                        }
                                    }
                                    if (mapKey !== -1) {
                                        uniqueMaps[mapCount++] = mapKey;
                                    }
                                }
                            }
                        }
                    }

                    this.mapBuildGroundData = new TypedArray1d(mapCount, null);
                    this.mapBuildLocationData = new TypedArray1d(mapCount, null);
                    this.mapBuildIndex = new Int32Array(mapCount);
                    this.mapBuildGroundFile = new Array(mapCount);
                    this.mapBuildLocationFile = new Array(mapCount);

                    for (let i: number = 0; i < mapCount; i++) {
                        const mapKey: number = (this.mapBuildIndex[i] = uniqueMaps[i]);
                        const mx: number = (mapKey >> 8) & 0xff;
                        const mz: number = mapKey & 0xff;
                        if (this.onDemand) {
                            const landFile = (this.mapBuildGroundFile[i] = this.onDemand.getMapFile(mx, mz, 0));
                            if (landFile !== -1) {
                                this.onDemand.request(3, landFile);
                            }
                            const locFile = (this.mapBuildLocationFile[i] = this.onDemand.getMapFile(mx, mz, 1));
                            if (locFile !== -1) {
                                this.onDemand.request(3, locFile);
                            }
                        } else {
                            this.mapBuildGroundFile[i] = -1;
                            this.mapBuildLocationFile[i] = -1;
                        }
                    }
                }

                const dx: number = this.mapBuildBaseX - this.mapBuildPrevBaseX;
                const dz: number = this.mapBuildBaseZ - this.mapBuildPrevBaseZ;
                this.mapBuildPrevBaseX = this.mapBuildBaseX;
                this.mapBuildPrevBaseZ = this.mapBuildBaseZ;

                for (let i: number = 0; i < 16384; i++) {
                    const npc: ClientNpc | null = this.npc[i];
                    if (npc) {
                        for (let j: number = 0; j < 10; j++) {
                            npc.routeX[j] -= dx;
                            npc.routeZ[j] -= dz;
                        }

                        npc.x -= dx * 128;
                        npc.z -= dz * 128;
                    }
                }

                for (let i: number = 0; i < MAX_PLAYER_COUNT; i++) {
                    const player: ClientPlayer | null = this.players[i];
                    if (player) {
                        for (let j: number = 0; j < 10; j++) {
                            player.routeX[j] -= dx;
                            player.routeZ[j] -= dz;
                        }

                        player.x -= dx * 128;
                        player.z -= dz * 128;
                    }
                }

                this.awaitingPlayerInfo = true;

                let startTileX: number = 0;
                let endTileX: number = BuildArea.SIZE;
                let dirX: number = 1;
                if (dx < 0) {
                    startTileX = BuildArea.SIZE - 1;
                    endTileX = -1;
                    dirX = -1;
                }

                let startTileZ: number = 0;
                let endTileZ: number = BuildArea.SIZE;
                let dirZ: number = 1;
                if (dz < 0) {
                    startTileZ = BuildArea.SIZE - 1;
                    endTileZ = -1;
                    dirZ = -1;
                }

                for (let x: number = startTileX; x !== endTileX; x += dirX) {
                    for (let z: number = startTileZ; z !== endTileZ; z += dirZ) {
                        const lastX: number = x + dx;
                        const lastZ: number = z + dz;

                        for (let level: number = 0; level < BuildArea.LEVELS; level++) {
                            if (lastX >= 0 && lastZ >= 0 && lastX < BuildArea.SIZE && lastZ < BuildArea.SIZE) {
                                this.groundObj[level][x][z] = this.groundObj[level][lastX][lastZ];
                            } else {
                                this.groundObj[level][x][z] = null;
                            }
                        }
                    }
                }

                for (let loc = this.locChanges.head(); loc !== null; loc = this.locChanges.next()) {
                    loc.x -= dx;
                    loc.z -= dz;

                    if (loc.x < 0 || loc.z < 0 || loc.x >= BuildArea.SIZE || loc.z >= BuildArea.SIZE) {
                        loc.unlink();
                    }
                }

                if (this.minimapFlagX !== 0) {
                    this.minimapFlagX -= dx;
                    this.minimapFlagZ -= dz;
                }

                this.cinemaCam = false;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.VARP_SMALL) {
                // 377: g2_alt2(varp), g1b_alt3(value); redraw sticky when open
                const varpId: number = this.in.g2_alt2();
                const value: number = this.in.g1b_alt3();

                this.varServ[varpId] = value;

                if (this.var[varpId] !== value) {
                    this.var[varpId] = value;
                    this.updateVarp(varpId);

                    this.redrawSide = true;

                    // Java: if (stickyChatInterfaceId != -1) redrawChatback
                    if (this.tutComId !== -1) {
                        this.redrawChat = true;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.VARP_LARGE) {
                // 377: g4_alt3(value), g2_alt1(varp); redraw sticky when open
                const value: number = this.in.g4_alt3();
                const varpId: number = this.in.g2_alt1();

                this.varServ[varpId] = value;

                if (this.var[varpId] !== value) {
                    this.var[varpId] = value;
                    this.updateVarp(varpId);

                    this.redrawSide = true;

                    // Java: if (stickyChatInterfaceId != -1) redrawChatback
                    if (this.tutComId !== -1) {
                        this.redrawChat = true;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.VARP_SYNC) {
                // "Resetting variables to authoritative set"
                for (let i: number = 0; i < this.var.length; i++) {
                    if (this.var[i] !== this.varServ[i]) {
                        this.var[i] = this.varServ[i];
                        this.updateVarp(i);

                        this.redrawSide = true;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.SYNTH_SOUND) {
                // 377 Java: g2 id, g1 loops, g2 delay; delay==65535 → play immediately
                const soundId: number = this.in.g2();
                const loops: number = this.in.g1();
                const delay: number = this.in.g2();

                if (delay === 65535) {
                    if (this.waveCount < 50) {
                        this.waveIds[this.waveCount] = soundId;
                        this.waveLoops[this.waveCount] = loops;
                        this.waveDelay[this.waveCount] = 0;
                        this.waveCount++;
                    }
                } else if (this.waveEnabled && !Client.lowMem && this.waveCount < 50) {
                    this.waveIds[this.waveCount] = soundId;
                    this.waveLoops[this.waveCount] = loops;
                    this.waveDelay[this.waveCount] = delay + JagFX.delays[soundId];
                    this.waveCount++;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.MIDI_SONG) {
                // 377 Java: g2_alt3(id)
                let songId: number = this.in.g2_alt3();
                if (songId == 65535) {
                    songId = -1;
                }

                if (this.nextMidiSong != songId && this.midiActive && !Client.lowMem && this.nextMusicDelay === 0) {
                    this.midiSong = songId;
                    this.midiFading = true;
                    this.onDemand?.request(2, this.midiSong);
                }

                this.nextMidiSong = songId;

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.MIDI_JINGLE) {
                // 377 Java: g2_alt1(id), g3_alt3(delay) — size 5
                const jingleId: number = this.in.g2_alt1();
                const delay: number = this.in.g3_alt3();

                if (this.midiActive && !Client.lowMem) {
                    this.midiSong = jingleId;
                    this.midiFading = false;
                    this.onDemand?.request(2, this.midiSong);
                    this.nextMusicDelay = delay;
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_ZONE_PARTIAL_FOLLOWS) {
                // 377 Java: baseX = g1_alt2(), baseZ = g1_alt1()
                this.zoneUpdateX = this.in.g1_alt2();
                this.zoneUpdateZ = this.in.g1_alt1();

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_ZONE_FULL_FOLLOWS) {
                // 377 Java: baseZ = g1_alt3(), baseX = g1_alt2() (Z then X; differs from partial)
                this.zoneUpdateZ = this.in.g1_alt3();
                this.zoneUpdateX = this.in.g1_alt2();

                for (let x: number = this.zoneUpdateX; x < this.zoneUpdateX + 8; x++) {
                    for (let z: number = this.zoneUpdateZ; z < this.zoneUpdateZ + 8; z++) {
                        if (this.groundObj[this.minusedlevel][x][z]) {
                            this.groundObj[this.minusedlevel][x][z] = null;
                            this.sortObjStacks(x, z);
                        }
                    }
                }

                for (let loc = this.locChanges.head(); loc !== null; loc = this.locChanges.next()) {
                    if (loc.x >= this.zoneUpdateX && loc.x < this.zoneUpdateX + 8 && loc.z >= this.zoneUpdateZ && loc.z < this.zoneUpdateZ + 8 && loc.level === this.minusedlevel) {
                        loc.endTime = 0;
                    }
                }

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.UPDATE_ZONE_PARTIAL_ENCLOSED) {
                // 377 Java: baseX = g1(), baseZ = g1_alt1()
                this.zoneUpdateX = this.in.g1();
                this.zoneUpdateZ = this.in.g1_alt1();

                while (this.in.pos < this.psize) {
                    const opcode: number = this.in.g1();
                    this.readZonePacket(this.in, opcode);
                }

                this.ptype = -1;
                return true;
            }

            if (
                this.ptype === ServerProt.OBJ_COUNT ||
                this.ptype === ServerProt.P_LOCMERGE ||
                this.ptype === ServerProt.OBJ_REVEAL ||
                this.ptype === ServerProt.MAP_ANIM ||
                this.ptype === ServerProt.MAP_PROJANIM ||
                this.ptype === ServerProt.OBJ_DEL ||
                this.ptype === ServerProt.OBJ_ADD ||
                this.ptype === ServerProt.LOC_ANIM ||
                this.ptype === ServerProt.LOC_DEL ||
                this.ptype === ServerProt.LOC_ADD_CHANGE ||
                this.ptype === ServerProt.SOUND_AREA
            ) {
                this.readZonePacket(this.in, this.ptype);

                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_OPENFULL) {
                // 377 Java ptype 253: g2_alt1(overlay→id1), g2_alt2(main→id0)
                // Login script: if_openfull(inter_353, inter_313) → main=353, overlay=313
                // Engine IfOpenFullEncoder: p2_alt1(overlayComponent), p2_alt2(mainComponent)
                let overlayCom: number = this.in.g2_alt1();
                const mainCom: number = this.in.g2_alt2();
                this.resetInterfaceAnimation(mainCom);
                // Java: if (var177 != -1) reset — unsigned g2 never -1; 65535 treated as none
                if (overlayCom !== 65535) {
                    this.resetInterfaceAnimation(overlayCom);
                } else {
                    overlayCom = -1;
                }
                if (this.mainModalId !== -1) {
                    this.unloadCom(this.mainModalId);
                    this.mainModalId = -1;
                }
                if (this.sideModalId !== -1) {
                    this.unloadCom(this.sideModalId);
                    this.sideModalId = -1;
                    this.redrawSide = true;
                    this.redrawIcons = true;
                }
                if (this.chatModalId !== -1) {
                    this.unloadCom(this.chatModalId);
                    this.chatModalId = -1;
                    this.redrawChat = true;
                }
                // Java compares id1 against main (var178) when deciding unload — port as-is
                if (this.fullscreenInterfaceId0 !== mainCom) {
                    this.unloadCom(this.fullscreenInterfaceId0);
                    this.fullscreenInterfaceId0 = mainCom;
                }
                if (this.fullscreenInterfaceId1 !== mainCom) {
                    this.unloadCom(this.fullscreenInterfaceId1);
                    this.fullscreenInterfaceId1 = overlayCom;
                }
                this.chatbackInputOpen = 0;
                this.dialogInputOpen = false;
                this.resumedPauseButton = false;
                this.redrawFrame = true;
                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETANGLE) {
                const xan = this.in.g2_alt2();
                const comId = this.in.g2_alt3();
                const zoom = this.in.g2_alt2();
                const yan = this.in.g2_alt1();
                const com = IfType.get(comId);
                if (com) {
                    com.modelXAn = xan;
                    com.modelYAn = yan;
                    com.modelZoom = zoom;
                }
                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.IF_SETROTATION) {
                // Java ptype 18: g2 + g2_alt2 + g2_alt1 → Component.field700 = (a << 16) + b
                const a = this.in.g2();
                const comId = this.in.g2_alt2();
                const b = this.in.g2_alt1();
                const com = IfType.get(comId);
                if (com) {
                    com.modelRotate = (a << 16) + b;
                }
                this.ptype = -1;
                return true;
            }

            if (this.ptype === ServerProt.P_NAMEDIALOG) {
                // Java ptype 6: showSocialInput=false; chatbackInputOpen=2; chatbackInput=""
                this.socialInputOpen = false;
                this.chatbackInputOpen = 2;
                this.dialogInputOpen = false;
                this.dialogInput = '';
                this.redrawChat = true;

                if (this.isMobile) {
                    MobileKeyboard.show();
                }

                this.ptype = -1;
                return true;
            }

            // (java tries to report this to the world)
            console.error(`T1 - ${this.ptype},${this.psize} - ${this.ptype1},${this.ptype2} (unhandled 377 opcode — logging out)`);
            await this.logout();
        } catch (e) {
            if (e instanceof WebSocket && e.readyState === 3) {
                // IO error
                await this.tryReconnect();
            } else {
                // logic error
                console.error(e);

                let str = `T2 - ${this.ptype},${this.psize} - ${this.ptype1},${this.ptype2} - ${this.psize},${(this.localPlayer?.routeX[0] ?? 0) + this.mapBuildBaseX},${(this.localPlayer?.routeZ[0] ?? 0) + this.mapBuildBaseZ} -`;
                for (let i = 0; i < this.psize && i < 50; i++) {
                    str += this.in.data[i] + ',';
                }
                // (java tries to report this to the world)
                console.error(str);

                await this.logout();
            }
        }

        return true;
    }

    private readZonePacket(buf: Packet, opcode: number): void {
        // 377 zone packets: each opcode has its own alt encoding and field order
        // (oracle: Client-Java readZonePacket / engine *Encoder). Coord is NOT always first plain g1.

        if (opcode === ServerProt.P_LOCMERGE) {
            // LOC_MERGE (203): g2, g1 info, g1b_alt2 west, g1_alt1 coord, g1b_alt1 east,
            // g2_alt2 end, g2_alt1 pid, g1b north, g1b_alt1 south, g2 start
            const id: number = buf.g2();
            const info: number = buf.g1();
            const shape: number = info >> 2;
            const rotate: number = info & 0x3;
            const layer: number = LOC_SHAPE_TO_LAYER[shape];
            let west: number = buf.g1b_alt2();
            const pos: number = buf.g1_alt1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);
            let east: number = buf.g1b_alt1();
            const endCycle: number = buf.g2_alt2();
            const pid: number = buf.g2_alt1();
            let north: number = buf.g1b();
            let south: number = buf.g1b_alt1();
            const startCycle: number = buf.g2();

            let player: ClientPlayer | null;
            if (pid === this.selfSlot) {
                player = this.localPlayer;
            } else {
                player = this.players[pid];
            }

            if (player && this.groundh) {
                const loc: LocType = LocType.list(id);
                const heightSW: number = this.groundh[this.minusedlevel][x][z];
                const heightSE: number = this.groundh[this.minusedlevel][x + 1][z];
                const heightNE: number = this.groundh[this.minusedlevel][x + 1][z + 1];
                const heightNW: number = this.groundh[this.minusedlevel][x][z + 1];
                const model = loc.getModel(shape, rotate, heightSW, heightSE, heightNE, heightNW, -1);
                if (model) {
                    // Java appendLoc: field1322=end+1, field1327=start+1 → TS endTime/startTime
                    this.storeLoc(this.minusedlevel, x, z, layer, -1, 0, 0, startCycle + 1, endCycle + 1);

                    player.locStartCycle = startCycle + Client.loopCycle;
                    player.locStopCycle = endCycle + Client.loopCycle;
                    player.locModel = model;

                    let width: number = loc.width;
                    let height: number = loc.length;
                    if (rotate === LocAngle.NORTH || rotate === LocAngle.SOUTH) {
                        width = loc.length;
                        height = loc.width;
                    }

                    player.locOffsetX = x * 128 + width * 64;
                    player.locOffsetZ = z * 128 + height * 64;
                    player.locOffsetY = this.getHeightmapY(player.locOffsetX, player.locOffsetZ, this.minusedlevel);

                    if (east > west) {
                        const tmp = east;
                        east = west;
                        west = tmp;
                    }
                    if (south > north) {
                        const tmp = south;
                        south = north;
                        north = tmp;
                    }

                    player.minTileX = x + east;
                    player.maxTileX = x + west;
                    player.minTileZ = z + south;
                    player.maxTileZ = z + north;
                }
            }
            return;
        }

        if (opcode === ServerProt.OBJ_REVEAL) {
            // g1_alt1 coord, g2_alt3 count, g2_alt2 obj, g2_alt2 pid
            const pos: number = buf.g1_alt1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);
            const count: number = buf.g2_alt3();
            const id: number = buf.g2_alt2();
            const pid: number = buf.g2_alt2();

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE && pid !== this.selfSlot) {
                if (!this.groundObj[this.minusedlevel][x][z]) {
                    this.groundObj[this.minusedlevel][x][z] = new LinkList();
                }
                const obj: ClientObj = new ClientObj(id, count);
                this.groundObj[this.minusedlevel][x][z]?.push(obj);
                this.sortObjStacks(x, z);
            }
            return;
        }

        if (opcode === ServerProt.LOC_ANIM) {
            // g2 seq, g1_alt1 info, g1 coord
            const seq: number = buf.g2();
            const info: number = buf.g1_alt1();
            let shape: number = info >> 2;
            const rotate: number = info & 0x3;
            const layer: number = LOC_SHAPE_TO_LAYER[shape];
            const pos: number = buf.g1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE - 1 && z < BuildArea.SIZE - 1 && this.world && this.groundh) {
                const heightSW = this.groundh[this.minusedlevel][x][z];
                const heightSE = this.groundh[this.minusedlevel][x + 1][z];
                const heightNE = this.groundh[this.minusedlevel][x + 1][z + 1];
                const heightNW = this.groundh[this.minusedlevel][x][z + 1];

                if (layer == 0) {
                    const wall = this.world.getWall(this.minusedlevel, x, z);
                    if (wall) {
                        const locId = (wall.typecode >> 14) & 0x7fff;
                        if (shape == 2) {
                            wall.model1 = new ClientLocAnim(locId, 2, rotate + 4, heightSW, heightSE, heightNE, heightNW, seq, false);
                            wall.model2 = new ClientLocAnim(locId, 2, (rotate + 1) & 0x3, heightSW, heightSE, heightNE, heightNW, seq, false);
                        } else {
                            wall.model1 = new ClientLocAnim(locId, shape, rotate, heightSW, heightSE, heightNE, heightNW, seq, false);
                        }
                    }
                } else if (layer == 1) {
                    const decor = this.world.getDecor(this.minusedlevel, z, x);
                    if (decor) {
                        // Java ClientLocAnim(seq, NE, NW, SE, shape=4, locId, false, SW, angle=0)
                        // → TS (index, shape, angle, SW, SE, NE, NW, seq, randomFrame)
                        decor.model = new ClientLocAnim((decor.typecode >> 14) & 0x7fff, 4, 0, heightSW, heightSE, heightNE, heightNW, seq, false);
                    }
                } else if (layer == 2) {
                    const sprite = this.world.getScene(this.minusedlevel, x, z);
                    if (shape == 11) {
                        shape = 10;
                    }
                    if (sprite) {
                        sprite.model = new ClientLocAnim((sprite.typecode >> 14) & 0x7fff, shape, rotate, heightSW, heightSE, heightNE, heightNW, seq, false);
                    }
                } else if (layer == 3) {
                    const decor = this.world.getGd(this.minusedlevel, x, z);
                    if (decor) {
                        decor.model = new ClientLocAnim((decor.typecode >> 14) & 0x7fff, 22, rotate, heightSW, heightSE, heightNE, heightNW, seq, false);
                    }
                }
            }
            return;
        }

        if (opcode === ServerProt.OBJ_ADD) {
            // g2 obj, g1_alt2 coord, g2_alt2 count
            const type: number = buf.g2();
            const pos: number = buf.g1_alt2();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);
            const count: number = buf.g2_alt2();

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE) {
                const obj: ClientObj = new ClientObj(type, count);
                if (!this.groundObj[this.minusedlevel][x][z]) {
                    this.groundObj[this.minusedlevel][x][z] = new LinkList();
                }
                this.groundObj[this.minusedlevel][x][z]?.push(obj);
                this.sortObjStacks(x, z);
            }
            return;
        }

        if (opcode === ServerProt.OBJ_COUNT) {
            // g1 coord, g2, g2, g2 (plain)
            const pos: number = buf.g1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);
            const type: number = buf.g2();
            const ocount: number = buf.g2();
            const count: number = buf.g2();

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE) {
                const objs = this.groundObj[this.minusedlevel][x][z];
                if (objs) {
                    for (let obj = objs.head(); obj !== null; obj = objs.next()) {
                        if (obj.id === (type & 0x7fff) && obj.count === ocount) {
                            obj.count = count;
                            break;
                        }
                    }
                    this.sortObjStacks(x, z);
                }
            }
            return;
        }

        if (opcode === ServerProt.MAP_PROJANIM) {
            // Java readZonePacket MAP_PROJANIM: g1 coord then plain g1b/g2 fields
            const pos: number = buf.g1();
            let x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            let z: number = this.zoneUpdateZ + (pos & 0x7);
            let x2: number = x + buf.g1b();
            let z2: number = z + buf.g1b();
            const targetEntity: number = buf.g2b();
            const spotanim: number = buf.g2();
            const h1: number = buf.g1() * 4;
            const h2: number = buf.g1() * 4;
            const t1: number = buf.g2();
            const t2: number = buf.g2();
            const angle: number = buf.g1();
            const startpos: number = buf.g1();

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE && x2 >= 0 && z2 >= 0 && x2 < BuildArea.SIZE && z2 < BuildArea.SIZE && spotanim !== 65535) {
                x = x * 128 + 64;
                z = z * 128 + 64;
                x2 = x2 * 128 + 64;
                z2 = z2 * 128 + 64;

                const proj: ClientProj = new ClientProj(spotanim, this.minusedlevel, x, this.getHeightmapY(x, z, this.minusedlevel) - h1, z, t1 + Client.loopCycle, t2 + Client.loopCycle, angle, startpos, targetEntity, h2);
                proj.setTarget(x2, this.getHeightmapY(x2, z2, this.minusedlevel) - h2, z2, t1 + Client.loopCycle);
                this.projectiles.push(proj);
            }
            return;
        }

        if (opcode === ServerProt.SOUND_AREA) {
            // g1 coord, g2 id, g1 (range<<4 | loops)
            const pos: number = buf.g1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);
            const soundId: number = buf.g2();
            const packed: number = buf.g1();
            const range: number = (packed >> 4) & 0xf;
            const loops: number = packed & 0x7;

            if (
                this.localPlayer &&
                this.localPlayer.routeX[0] >= x - range &&
                this.localPlayer.routeX[0] <= x + range &&
                this.localPlayer.routeZ[0] >= z - range &&
                this.localPlayer.routeZ[0] <= z + range &&
                this.waveEnabled &&
                !Client.lowMem &&
                this.waveCount < 50
            ) {
                this.waveIds[this.waveCount] = soundId;
                this.waveLoops[this.waveCount] = loops;
                this.waveDelay[this.waveCount] = JagFX.delays[soundId] ?? 0;
                this.waveCount++;
            }
            return;
        }

        if (opcode === ServerProt.MAP_ANIM) {
            // g1 coord, g2 spot, g1 height, g2 delay
            const pos: number = buf.g1();
            let x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            let z: number = this.zoneUpdateZ + (pos & 0x7);
            const spotanim: number = buf.g2();
            const height: number = buf.g1();
            const time: number = buf.g2();

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE) {
                x = x * 128 + 64;
                z = z * 128 + 64;
                const spot: MapSpotAnim = new MapSpotAnim(spotanim, this.minusedlevel, x, z, this.getHeightmapY(x, z, this.minusedlevel) - height, Client.loopCycle, time);
                this.spotanims.push(spot);
            }
            return;
        }

        if (opcode === ServerProt.LOC_ADD_CHANGE) {
            // g1_alt2 info, g2_alt3 loc, g1_alt1 coord
            const info: number = buf.g1_alt2();
            const shape: number = info >> 2;
            const rotate: number = info & 0x3;
            const layer: number = LOC_SHAPE_TO_LAYER[shape];
            const id: number = buf.g2_alt3();
            const pos: number = buf.g1_alt1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE) {
                this.storeLoc(this.minusedlevel, x, z, layer, id, shape, rotate, 0, -1);
            }
            return;
        }

        if (opcode === ServerProt.OBJ_DEL) {
            // g2_alt2 obj, g1_alt1 coord
            const type: number = buf.g2_alt2();
            const pos: number = buf.g1_alt1();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE) {
                const objs = this.groundObj[this.minusedlevel][x][z];
                if (objs) {
                    for (let obj = objs.head(); obj !== null; obj = objs.next()) {
                        if (obj.id === (type & 0x7fff)) {
                            obj.unlink();
                            break;
                        }
                    }
                    if (objs.head() === null) {
                        this.groundObj[this.minusedlevel][x][z] = null;
                    }
                    this.sortObjStacks(x, z);
                }
            }
            return;
        }

        if (opcode === ServerProt.LOC_DEL) {
            // g1_alt3 coord, g1_alt3 info
            const pos: number = buf.g1_alt3();
            const x: number = this.zoneUpdateX + ((pos >> 4) & 0x7);
            const z: number = this.zoneUpdateZ + (pos & 0x7);
            const info: number = buf.g1_alt3();
            const shape: number = info >> 2;
            const rotate: number = info & 0x3;
            const layer: number = LOC_SHAPE_TO_LAYER[shape];

            if (x >= 0 && z >= 0 && x < BuildArea.SIZE && z < BuildArea.SIZE) {
                this.storeLoc(this.minusedlevel, x, z, layer, -1, shape, rotate, 0, -1);
            }
            return;
        }
    }

    private storeLoc(level: number, x: number, z: number, layer: number, type: number, shape: number, angle: number, startTime: number, endTime: number): void {
        let loc: LocChange | null = null;
        for (let next = this.locChanges.head(); next !== null; next = this.locChanges.next()) {
            if (next.level === this.minusedlevel && next.x === x && next.z === z && next.layer === layer) {
                loc = next;
                break;
            }
        }

        if (!loc) {
            loc = new LocChange();
            loc.level = level;
            loc.layer = layer;
            loc.x = x;
            loc.z = z;
            this.appendLoc(loc);
            this.locChanges.push(loc);
        }

        loc.newType = type;
        loc.newShape = shape;
        loc.newAngle = angle;
        loc.startTime = startTime;
        loc.endTime = endTime;
    }

    /**
     * Port of Client-Java `clearLocChanges` (377) — run after mapBuild places ground objs.
     * Keeps permanent changes (endTime == -1), re-snapshots old type; unlinks timed ones.
     */
    private clearLocChanges(): void {
        for (let loc = this.locChanges.head(); loc !== null; loc = this.locChanges.next()) {
            if (loc.endTime === -1) {
                loc.startTime = 0;
                this.appendLoc(loc);
            } else {
                loc.unlink();
            }
        }
    }

    private appendLoc(loc: LocChange): void {
        if (!this.world) {
            return;
        }

        let typecode: number = 0;
        let otherId: number = -1;
        let otherShape: number = 0;
        let otherAngle: number = 0;

        if (loc.layer === LocLayer.WALL) {
            typecode = this.world.wallType(loc.level, loc.x, loc.z);
        } else if (loc.layer === LocLayer.WALL_DECOR) {
            typecode = this.world.decorType(loc.level, loc.z, loc.x);
        } else if (loc.layer === LocLayer.GROUND) {
            typecode = this.world.sceneType(loc.level, loc.x, loc.z);
        } else if (loc.layer === LocLayer.GROUND_DECOR) {
            typecode = this.world.gdType(loc.level, loc.x, loc.z);
        }

        if (typecode !== 0) {
            const otherInfo: number = this.world.typeCode2(loc.level, loc.x, loc.z, typecode);
            otherId = (typecode >> 14) & 0x7fff;
            otherShape = otherInfo & 0x1f;
            otherAngle = otherInfo >> 6;
        }

        loc.oldType = otherId;
        loc.oldShape = otherShape;
        loc.oldAngle = otherAngle;
    }

    /**
     * Port of Client-Java `updateLocChanges` (377).
     * Called each game tick when sceneState==2; advances timers and applies addLoc.
     */
    private updateLocChanges(): void {
        if (this.sceneState !== 2) {
            return;
        }

        for (let loc = this.locChanges.head(); loc !== null; loc = this.locChanges.next()) {
            // Java field1322 = endTime, field1327 = startTime
            if (loc.endTime > 0) {
                loc.endTime--;
            }

            if (loc.endTime != 0) {
                if (loc.startTime > 0) {
                    loc.startTime--;
                }

                if (loc.startTime === 0 && loc.x >= 1 && loc.z >= 1 && loc.x <= 102 && loc.z <= 102 && (loc.newType < 0 || ClientBuild.changeLocAvailable(loc.newType, loc.newShape))) {
                    this.addLoc(loc.level, loc.layer, loc.x, loc.z, loc.newType, loc.newShape, loc.newAngle);
                    loc.startTime = -1;

                    if (loc.oldType === loc.newType && loc.oldType === -1) {
                        loc.unlink();
                    } else if (loc.oldType === loc.newType && loc.oldAngle === loc.newAngle && loc.oldShape === loc.newShape) {
                        loc.unlink();
                    }
                }
            } else if (loc.oldType < 0 || ClientBuild.changeLocAvailable(loc.oldType, loc.oldShape)) {
                this.addLoc(loc.level, loc.layer, loc.x, loc.z, loc.oldType, loc.oldShape, loc.oldAngle);
                loc.unlink();
            }
        }
    }

    private addLoc(level: number, layer: number, x: number, z: number, id: number, shape: number, angle: number): void {
        if (x < 1 || z < 1 || x > 102 || z > 102) {
            return;
        }

        if (Client.lowMem && level !== this.minusedlevel) {
            return;
        }

        if (!this.world) {
            return;
        }

        let typecode: number = 0;
        if (layer === LocLayer.WALL) {
            typecode = this.world.wallType(level, x, z);
        } else if (layer === LocLayer.WALL_DECOR) {
            typecode = this.world.decorType(level, z, x);
        } else if (layer === LocLayer.GROUND) {
            typecode = this.world.sceneType(level, x, z);
        } else if (layer === LocLayer.GROUND_DECOR) {
            typecode = this.world.gdType(level, x, z);
        }

        if (typecode !== 0) {
            const otherInfo: number = this.world.typeCode2(level, x, z, typecode);
            const otherId: number = (typecode >> 14) & 0x7fff;
            const otherShape: number = otherInfo & 0x1f;
            const otherAngle: number = otherInfo >> 6;

            if (layer === LocLayer.WALL) {
                this.world?.delWall(level, x, z);

                const type: LocType = LocType.list(otherId);
                if (type.blockwalk) {
                    this.collision[level]?.delWall(x, z, otherShape, otherAngle, type.blockrange);
                }
            } else if (layer === LocLayer.WALL_DECOR) {
                this.world?.delDecor(level, x, z);
            } else if (layer === LocLayer.GROUND) {
                this.world.delLoc(level, x, z);

                const type: LocType = LocType.list(otherId);
                if (x + type.width > BuildArea.SIZE - 1 || z + type.width > BuildArea.SIZE - 1 || x + type.length > BuildArea.SIZE - 1 || z + type.length > BuildArea.SIZE - 1) {
                    return;
                }

                if (type.blockwalk) {
                    this.collision[level]?.delLoc(x, z, type.width, type.length, otherAngle, type.blockrange);
                }
            } else if (layer === LocLayer.GROUND_DECOR) {
                this.world?.delGroundDecor(level, x, z);

                const type: LocType = LocType.list(otherId);
                if (type.blockwalk && type.active) {
                    this.collision[level]?.unblockGround(x, z);
                }
            }
        }

        if (id >= 0) {
            let tileLevel: number = level;
            if (this.mapl && level < 3 && (this.mapl[1][x][z] & MapFlag.LinkBelow) !== 0) {
                tileLevel = level + 1;
            }

            if (this.groundh) {
                ClientBuild.changeLocUnchecked(level, x, z, id, shape, angle, tileLevel, this.groundh, this.world, this.collision[level]);
            }
        }
    }

    private sortObjStacks(x: number, z: number): void {
        const objs = this.groundObj[this.minusedlevel][x][z];
        if (!objs) {
            this.world?.delObj(this.minusedlevel, x, z);
            return;
        }

        let topCost: number = -99999999;
        let topObj: ClientObj | null = null;

        for (let obj = objs.head(); obj !== null; obj = objs.next()) {
            const type: ObjType = ObjType.list(obj.id);
            let cost: number = type.cost;

            if (type.stackable) {
                cost *= obj.count + 1;
            }

            if (cost > topCost) {
                topCost = cost;
                topObj = obj;
            }
        }

        if (!topObj) {
            return; // custom
        }

        objs.pushFront(topObj);

        let bottomObj: ClientObj | null = null;
        let middleObj: ClientObj | null = null;
        for (let obj = objs.head(); obj !== null; obj = objs.next()) {
            if (obj.id !== topObj.id && bottomObj === null) {
                bottomObj = obj;
            }

            if (obj.id !== topObj.id && bottomObj && obj.id !== bottomObj.id && middleObj === null) {
                middleObj = obj;
            }
        }

        const typecode: number = (x + (z << 7) + 0x60000000) | 0;
        this.world?.setObj(x, z, this.getHeightmapY(x * 128 + 64, z * 128 + 64, this.minusedlevel), this.minusedlevel, typecode, topObj, middleObj, bottomObj);
    }

    private getPlayerPos(buf: Packet, size: number): void {
        this.entityRemovalCount = 0;
        this.entityUpdateCount = 0;

        this.getPlayerLocal(buf, size);
        this.getPlayerOldVis(buf, size);
        this.getPlayerNewVis(buf, size);
        this.getPlayerExtended(buf, size);

        for (let i: number = 0; i < this.entityRemovalCount; i++) {
            const index: number = this.entityRemovalIds[i];
            const player: ClientPlayer | null = this.players[index];
            if (!player) {
                continue;
            }

            if (player.cycle !== Client.loopCycle) {
                this.players[index] = null;
            }
        }

        if (buf.pos !== size) {
            console.error(`Error packet size mismatch in getplayer pos:${buf.pos} psize:${size}`);
            throw new Error('eek');
        }

        for (let index: number = 0; index < this.playerCount; index++) {
            if (!this.players[this.playerIds[index]]) {
                console.error(`${this.loginUser} null entry in pl list - pos:${index} size:${this.playerCount}`);
                throw new Error('eek');
            }
        }
    }

    private getPlayerLocal(buf: Packet, _size: number): void {
        buf.gBitStart();

        const info: number = buf.gBit(1);
        if (info !== 0) {
            const op: number = buf.gBit(2);

            if (op === 0) {
                this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
            } else if (op === 1) {
                const walkDir: number = buf.gBit(3);
                this.localPlayer?.moveCode(false, walkDir);

                const extendedInfo: number = buf.gBit(1);
                if (extendedInfo === 1) {
                    this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
                }
            } else if (op === 2) {
                const walkDir: number = buf.gBit(3);
                this.localPlayer?.moveCode(true, walkDir);

                const runDir: number = buf.gBit(3);
                this.localPlayer?.moveCode(true, runDir);

                const extendedInfo: number = buf.gBit(1);
                if (extendedInfo === 1) {
                    this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
                }
            } else if (op === 3) {
                // 377 Java: jump, level, z, x, then extended (order differs from 289)
                const jump: number = buf.gBit(1);
                this.minusedlevel = buf.gBit(2);
                const localZ: number = buf.gBit(7);
                const localX: number = buf.gBit(7);

                const extendedInfo: number = buf.gBit(1);
                if (extendedInfo === 1) {
                    this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
                }

                this.localPlayer?.teleport(jump === 1, localX, localZ);
            }
        }
    }

    private getPlayerOldVis(buf: Packet, _size: number): void {
        const count: number = buf.gBit(8);

        if (count < this.playerCount) {
            for (let i: number = count; i < this.playerCount; i++) {
                this.entityRemovalIds[this.entityRemovalCount++] = this.playerIds[i];
            }
        }

        if (count > this.playerCount) {
            console.error(`eek! ${this.loginUser} Too many players`);
            throw new Error();
        }

        this.playerCount = 0;
        for (let i: number = 0; i < count; i++) {
            const index: number = this.playerIds[i];
            const player: ClientPlayer | null = this.players[index];

            const info: number = buf.gBit(1);
            if (info === 0) {
                this.playerIds[this.playerCount++] = index;
                if (player) {
                    player.cycle = Client.loopCycle;
                }
            } else {
                const op: number = buf.gBit(2);

                if (op === 0) {
                    this.playerIds[this.playerCount++] = index;
                    if (player) {
                        player.cycle = Client.loopCycle;
                    }
                    this.entityUpdateIds[this.entityUpdateCount++] = index;
                } else if (op === 1) {
                    this.playerIds[this.playerCount++] = index;
                    if (player) {
                        player.cycle = Client.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    player?.moveCode(false, walkDir);

                    const extendedInfo: number = buf.gBit(1);
                    if (extendedInfo === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (op === 2) {
                    this.playerIds[this.playerCount++] = index;
                    if (player) {
                        player.cycle = Client.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    player?.moveCode(true, walkDir);

                    const runDir: number = buf.gBit(3);
                    player?.moveCode(true, runDir);

                    const extendedInfo: number = buf.gBit(1);
                    if (extendedInfo === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (op === 3) {
                    this.entityRemovalIds[this.entityRemovalCount++] = index;
                }
            }
        }
    }

    private getPlayerNewVis(buf: Packet, size: number): void {
        while (buf.bitPos + 10 < size * 8) {
            const index = buf.gBit(11);
            if (index === 2047) {
                break;
            }

            if (!this.players[index]) {
                this.players[index] = new ClientPlayer();

                const appearance: Packet | null = this.playerAppearanceBuffer[index];
                if (appearance) {
                    this.players[index]?.setAppearance(appearance);
                }
            }

            this.playerIds[this.playerCount++] = index;
            const player: ClientPlayer | null = this.players[index];
            if (player) {
                player.cycle = Client.loopCycle;
            }

            // 377 Java: dx(5), extended(1), jump(1), dz(5) — not dx/dz/jump/extended
            let dx: number = buf.gBit(5);
            if (dx > 15) {
                dx -= 32;
            }

            const extendedInfo: number = buf.gBit(1);
            if (extendedInfo === 1) {
                this.entityUpdateIds[this.entityUpdateCount++] = index;
            }

            const jump: number = buf.gBit(1);

            let dz: number = buf.gBit(5);
            if (dz > 15) {
                dz -= 32;
            }

            if (this.localPlayer) {
                player?.teleport(jump === 1, this.localPlayer.routeX[0] + dx, this.localPlayer.routeZ[0] + dz);
            }
        }

        buf.gBitEnd();
        // Java getPlayerNewVis sets ptype=-1 after accessBytes; handler also clears.
        this.ptype = -1;
    }

    private getPlayerExtended(buf: Packet, _size: number): void {
        // Java getPlayerExtended: always g1 mask (+ BIG high byte) before body.
        // Never skip a slot — null continue would desync the stream.
        for (let i: number = 0; i < this.entityUpdateCount; i++) {
            const index: number = this.entityUpdateIds[i];
            const player: ClientPlayer | null = this.players[index];

            // 377 Java: BIG flag is 0x20 (not 0x80 as in 289)
            let mask: number = buf.g1();
            if ((mask & PlayerUpdate.BIG_UPDATE) !== 0) {
                mask += buf.g1() << 8;
            }

            if (!player) {
                throw new Error(`null player in getPlayerExtended index=${index}`);
            }

            this.getPlayerExtendedInfo(player, index, mask, buf);
        }
    }

    private getPlayerExtendedInfo(player: ClientPlayer, index: number, mask: number, buf: Packet): void {
        // Process order + alts match Client-Java getPlayerExtended (377)
        if ((mask & PlayerUpdate.ANIM) !== 0) {
            let seqId: number = buf.g2();
            if (seqId === 65535) {
                seqId = -1;
            }
            const delay: number = buf.g1_alt3();
            if (player.primaryAnim === seqId && seqId !== -1) {
                const restartMode = SeqType.list[seqId].duplicatebehaviour;
                if (restartMode == RestartMode.RESET) {
                    player.primaryAnimFrame = 0;
                    player.primaryAnimCycle = 0;
                    player.primaryAnimDelay = delay;
                    player.primaryAnimLoop = 0;
                } else if (restartMode == RestartMode.RESETLOOP) {
                    player.primaryAnimLoop = 0;
                }
            } else if (seqId === -1 || player.primaryAnim === -1 || SeqType.list[seqId].priority >= SeqType.list[player.primaryAnim].priority) {
                player.primaryAnim = seqId;
                player.primaryAnimFrame = 0;
                player.primaryAnimCycle = 0;
                player.primaryAnimDelay = delay;
                player.primaryAnimLoop = 0;
                player.preanimRouteLength = player.routeLength;
            }
        }

        if ((mask & PlayerUpdate.SAY) !== 0) {
            player.chatMessage = buf.gjstr();
            if (player.chatMessage.charAt(0) === '~') {
                player.chatMessage = player.chatMessage.substring(1);
                if (player.name) {
                    this.addMessage(player.name, player.chatMessage, 2);
                }
            } else if (this.localPlayer === player && player.name) {
                this.addMessage(player.name, player.chatMessage, 2);
            }
            player.chatColour = 0;
            player.chatEffect = 0;
            player.chatTimer = 150;
        }

        if ((mask & PlayerUpdate.EXACTMOVE) !== 0) {
            player.exactStartX = buf.g1_alt1();
            player.exactStartZ = buf.g1_alt2();
            player.exactEndX = buf.g1_alt3();
            player.exactEndZ = buf.g1();
            player.exactMoveEnd = buf.g2() + Client.loopCycle;
            player.exactMoveStart = buf.g2_alt2() + Client.loopCycle;
            player.exactMoveFacing = buf.g1();
            player.abortRoute();
        }

        if ((mask & PlayerUpdate.FACEENTITY) !== 0) {
            player.faceEntity = buf.g2_alt2();
            if (player.faceEntity === 65535) {
                player.faceEntity = -1;
            }
        }

        if ((mask & PlayerUpdate.FACESQUARE) !== 0) {
            player.faceSquareX = buf.g2();
            player.faceSquareZ = buf.g2();
        }

        if ((mask & PlayerUpdate.SPOTANIM) !== 0) {
            player.spotanimId = buf.g2_alt2();
            const heightDelay: number = buf.g4_alt2();
            player.spotanimHeight = heightDelay >> 16;
            player.spotanimLastCycle = Client.loopCycle + (heightDelay & 0xffff);
            player.spotanimFrame = 0;
            player.spotanimCycle = 0;
            if (player.spotanimLastCycle > Client.loopCycle) {
                player.spotanimFrame = -1;
            }
            if (player.spotanimId === 65535) {
                player.spotanimId = -1;
            }
        }

        if ((mask & PlayerUpdate.APPEARANCE) !== 0) {
            const length: number = buf.g1();
            const data: Uint8Array = new Uint8Array(length);
            const appearance: Packet = new Packet(data);
            buf.gdata_alt1(data, 0, length);
            this.playerAppearanceBuffer[index] = appearance;
            player.setAppearance(appearance);
        }

        if ((mask & PlayerUpdate.HITMARK) !== 0) {
            // DAMAGE: g1_alt1 value, g1_alt3 type, g1_alt2 health, g1 total
            const damage = buf.g1_alt1();
            const damageType = buf.g1_alt3();
            player.addHitmark(Client.loopCycle, damageType, damage);
            player.combatCycle = Client.loopCycle + 300;
            player.health = buf.g1_alt2();
            player.totalHealth = buf.g1();
        }

        if ((mask & PlayerUpdate.CHAT) !== 0) {
            const colourEffect: number = buf.g2();
            const type: number = buf.g1_alt2();
            const length: number = buf.g1_alt1();
            const start: number = buf.pos;

            if (player.name && player.ready) {
                const username: bigint = JString.toUserhash(player.name);
                let ignored: boolean = false;
                if (type <= 1) {
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreUserhash[i] === username) {
                            ignored = true;
                            break;
                        }
                    }
                }
                if (!ignored && this.chatDisabled === 0) {
                    try {
                        const packed = new Uint8Array(length);
                        buf.gdata_alt2(packed, 0, length);
                        const chatBuf = new Packet(packed);
                        const uncompressed: string = WordPack.unpack(chatBuf, length);
                        const filtered: string = WordFilter.filter(uncompressed);
                        player.chatMessage = filtered;
                        player.chatColour = colourEffect >> 8;
                        player.chatEffect = colourEffect & 0xff;
                        player.chatTimer = 150;
                        if (type === 2 || type === 3) {
                            this.addMessage('@cr2@' + player.name, filtered, 1);
                        } else if (type === 1) {
                            this.addMessage('@cr1@' + player.name, filtered, 1);
                        } else {
                            this.addMessage(player.name, filtered, 2);
                        }
                    } catch (_e) {
                        // signlink.reporterror('cde2');
                    }
                }
            }
            buf.pos = start + length;
        }

        if ((mask & PlayerUpdate.HITMARK2) !== 0) {
            // DAMAGE2: g1_alt3 value, g1_alt2 type, g1_alt3 health, g1 total
            const damage = buf.g1_alt3();
            const damageType = buf.g1_alt2();
            player.addHitmark(Client.loopCycle, damageType, damage);
            player.combatCycle = Client.loopCycle + 300;
            player.health = buf.g1_alt3();
            player.totalHealth = buf.g1();
        }
    }

    private getNpcPos(buf: Packet, size: number): void {
        this.entityRemovalCount = 0;
        this.entityUpdateCount = 0;

        this.getNpcPosOldVis(buf, size);
        this.getNpcPosNewVis(buf, size);
        this.getNpcPosExtended(buf, size);

        for (let i: number = 0; i < this.entityRemovalCount; i++) {
            const index: number = this.entityRemovalIds[i];
            const npc: ClientNpc | null = this.npc[index];
            if (!npc) {
                continue;
            }

            if (npc.cycle !== Client.loopCycle) {
                npc.type = null;
                this.npc[index] = null;
            }
        }

        if (buf.pos !== size) {
            console.error(`eek! ${this.loginUser} size mismatch in getnpcpos - pos:${buf.pos} psize:${size}`);
            throw new Error('eek');
        }

        for (let i: number = 0; i < this.npcCount; i++) {
            if (!this.npc[this.npcIds[i]]) {
                console.error(`eek! ${this.loginUser} null entry in npc list - pos:${i} size:${this.npcCount}`);
                throw new Error('eek');
            }
        }
    }

    private getNpcPosOldVis(buf: Packet, size: number): void {
        buf.gBitStart();

        const count: number = buf.gBit(8);
        if (count < this.npcCount) {
            for (let i: number = count; i < this.npcCount; i++) {
                this.entityRemovalIds[this.entityRemovalCount++] = this.npcIds[i];
            }
        }

        if (count > this.npcCount) {
            console.error(`eek! ${this.loginUser} Too many npcs`);
            throw new Error('eek');
        }

        this.npcCount = 0;
        for (let i: number = 0; i < count; i++) {
            const index: number = this.npcIds[i];
            const npc: ClientNpc | null = this.npc[index];

            const info: number = buf.gBit(1);
            if (info === 0) {
                this.npcIds[this.npcCount++] = index;
                if (npc) {
                    npc.cycle = Client.loopCycle;
                }
            } else {
                const op: number = buf.gBit(2);

                if (op === 0) {
                    this.npcIds[this.npcCount++] = index;
                    if (npc) {
                        npc.cycle = Client.loopCycle;
                    }
                    this.entityUpdateIds[this.entityUpdateCount++] = index;
                } else if (op === 1) {
                    this.npcIds[this.npcCount++] = index;
                    if (npc) {
                        npc.cycle = Client.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    npc?.moveCode(false, walkDir);

                    const extendedInfo: number = buf.gBit(1);
                    if (extendedInfo === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (op === 2) {
                    this.npcIds[this.npcCount++] = index;
                    if (npc) {
                        npc.cycle = Client.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    npc?.moveCode(true, walkDir);

                    const runDir: number = buf.gBit(3);
                    npc?.moveCode(true, runDir);

                    const extendedInfo: number = buf.gBit(1);
                    if (extendedInfo === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (op === 3) {
                    this.entityRemovalIds[this.entityRemovalCount++] = index;
                }
            }
        }
    }

    private getNpcPosNewVis(buf: Packet, size: number): void {
        // 377 Java: index(14), extended(1), dz(5), dx(5), jump(1), type(13)
        while (buf.bitPos + 21 < size * 8) {
            const index: number = buf.gBit(14);
            if (index === 16383) {
                break;
            }

            if (!this.npc[index]) {
                this.npc[index] = new ClientNpc();
            }

            const npc: ClientNpc | null = this.npc[index];
            this.npcIds[this.npcCount++] = index;

            if (npc) {
                npc.cycle = Client.loopCycle;
            }

            const extendedInfo: number = buf.gBit(1);
            if (extendedInfo === 1) {
                this.entityUpdateIds[this.entityUpdateCount++] = index;
            }

            let dz: number = buf.gBit(5);
            if (dz > 15) {
                dz -= 32;
            }

            let dx: number = buf.gBit(5);
            if (dx > 15) {
                dx -= 32;
            }

            const jump = buf.gBit(1);
            const typeId: number = buf.gBit(13);

            if (npc) {
                npc.type = NpcType.list(typeId);
                npc.size = npc.type.size;
                npc.turnspeed = npc.type.turnspeed;
                npc.walkanim = npc.type.walkanim;
                npc.walkanim_b = npc.type.walkanim_b;
                npc.walkanim_l = npc.type.walkanim_r;
                npc.walkanim_r = npc.type.walkanim_l;
                npc.readyanim = npc.type.readyanim;

                if (this.localPlayer) {
                    npc.teleport(jump === 1, this.localPlayer.routeX[0] + dx, this.localPlayer.routeZ[0] + dz);
                }
            }
        }

        buf.gBitEnd();
    }

    private getNpcPosExtended(buf: Packet, _size: number): void {
        // Process order + alts match Client-Java getNpcPosExtended (377).
        // Always consume mask first — never continue on null (stream desync).
        for (let i: number = 0; i < this.entityUpdateCount; i++) {
            const id: number = this.entityUpdateIds[i];
            const npc: ClientNpc | null = this.npc[id];
            const mask: number = buf.g1();

            if (!npc) {
                throw new Error(`null npc in getNpcPosExtended id=${id}`);
            }

            if ((mask & NpcUpdate.CHANGETYPE) !== 0) {
                npc.type = NpcType.list(buf.g2_alt2());
                npc.size = npc.type.size;
                npc.turnspeed = npc.type.turnspeed;
                npc.walkanim = npc.type.walkanim;
                npc.walkanim_b = npc.type.walkanim_b;
                npc.walkanim_l = npc.type.walkanim_r;
                npc.walkanim_r = npc.type.walkanim_l;
                npc.readyanim = npc.type.readyanim;
            }

            if ((mask & NpcUpdate.FACEENTITY) !== 0) {
                npc.faceEntity = buf.g2_alt1();
                if (npc.faceEntity === 65535) {
                    npc.faceEntity = -1;
                }
            }

            if ((mask & NpcUpdate.HITMARK) !== 0) {
                // DAMAGE: g1_alt1 value, g1_alt1 type, g1 health, g1_alt3 total
                const damage = buf.g1_alt1();
                const damageType = buf.g1_alt1();
                npc.addHitmark(Client.loopCycle, damageType, damage);
                npc.combatCycle = Client.loopCycle + 300;
                npc.health = buf.g1();
                npc.totalHealth = buf.g1_alt3();
            }

            if ((mask & NpcUpdate.SPOTANIM) !== 0) {
                npc.spotanimId = buf.g2();
                const info: number = buf.g4_alt2();
                npc.spotanimHeight = info >> 16;
                npc.spotanimLastCycle = Client.loopCycle + (info & 0xffff);
                npc.spotanimFrame = 0;
                npc.spotanimCycle = 0;
                if (npc.spotanimLastCycle > Client.loopCycle) {
                    npc.spotanimFrame = -1;
                }
                if (npc.spotanimId === 65535) {
                    npc.spotanimId = -1;
                }
            }

            if ((mask & NpcUpdate.SAY) !== 0) {
                npc.chatMessage = buf.gjstr();
                npc.chatTimer = 100;
            }

            if ((mask & NpcUpdate.FACESQUARE) !== 0) {
                npc.faceSquareX = buf.g2_alt3();
                npc.faceSquareZ = buf.g2_alt1();
            }

            if ((mask & NpcUpdate.ANIM) !== 0) {
                let anim: number = buf.g2();
                if (anim === 65535) {
                    anim = -1;
                }
                const delay: number = buf.g1_alt3();
                if (npc.primaryAnim === anim && anim !== -1) {
                    const restartMode = SeqType.list[anim].duplicatebehaviour;
                    if (restartMode == RestartMode.RESET) {
                        npc.primaryAnimFrame = 0;
                        npc.primaryAnimCycle = 0;
                        npc.primaryAnimDelay = delay;
                        npc.primaryAnimLoop = 0;
                    } else if (restartMode == RestartMode.RESETLOOP) {
                        npc.primaryAnimLoop = 0;
                    }
                } else if (anim === -1 || npc.primaryAnim === -1 || SeqType.list[anim].priority >= SeqType.list[npc.primaryAnim].priority) {
                    npc.primaryAnim = anim;
                    npc.primaryAnimFrame = 0;
                    npc.primaryAnimCycle = 0;
                    npc.primaryAnimDelay = delay;
                    npc.primaryAnimLoop = 0;
                    npc.preanimRouteLength = npc.routeLength;
                }
            }

            if ((mask & NpcUpdate.HITMARK2) !== 0) {
                // DAMAGE2: g1_alt3 value, g1_alt3 type, g1 health, g1_alt2 total
                const damage = buf.g1_alt3();
                const damageType = buf.g1_alt3();
                npc.addHitmark(Client.loopCycle, damageType, damage);
                npc.combatCycle = Client.loopCycle + 300;
                npc.health = buf.g1();
                npc.totalHealth = buf.g1_alt2();
            }
        }
    }

    private handleMouseInput(): void {
        if (this.objDragArea !== 0) {
            return;
        }

        if (this.isMobile && this.dialogInputOpen && this.insideChatPopup()) {
            return;
        }

        let button: number = this.mouseClickButton;
        if (this.targetMode === 1 && this.mouseClickX >= 516 && this.mouseClickY >= 160 && this.mouseClickX <= 765 && this.mouseClickY <= 205) {
            button = 0;
        }

        if (this.isMenuOpen) {
            if (button === 1) {
                const menuX: number = this.menuX;
                const menuY: number = this.menuY;
                const menuWidth: number = this.menuWidth;

                let clickX: number = this.mouseClickX;
                let clickY: number = this.mouseClickY;

                if (this.menuArea === 0) {
                    clickX -= 4;
                    clickY -= 4;
                } else if (this.menuArea === 1) {
                    clickX -= 553;
                    clickY -= 205;
                } else if (this.menuArea === 2) {
                    clickX -= 17;
                    clickY -= 357;
                }

                let option: number = -1;
                for (let i: number = 0; i < this.menuNumEntries; i++) {
                    const optionY: number = menuY + (this.menuNumEntries - 1 - i) * 15 + 31;
                    if (clickX > menuX && clickX < menuX + menuWidth && clickY > optionY - 13 && clickY < optionY + 3) {
                        option = i;
                    }
                }

                if (option !== -1) {
                    this.useMenuOption(option);
                }

                this.isMenuOpen = false;

                if (this.menuArea === 1) {
                    this.redrawSide = true;
                } else if (this.menuArea === 2) {
                    this.redrawChat = true;
                }
            } else {
                let x: number = this.mouseX;
                let y: number = this.mouseY;

                if (this.menuArea === 0) {
                    x -= 4;
                    y -= 4;
                } else if (this.menuArea === 1) {
                    x -= 553;
                    y -= 205;
                } else if (this.menuArea === 2) {
                    x -= 17;
                    y -= 357;
                }

                if (x < this.menuX - 10 || x > this.menuX + this.menuWidth + 10 || y < this.menuY - 10 || y > this.menuY + this.menuHeight + 10) {
                    this.isMenuOpen = false;

                    if (this.menuArea === 1) {
                        this.redrawSide = true;
                    }

                    if (this.menuArea === 2) {
                        this.redrawChat = true;
                    }
                }
            }
        } else {
            if (button === 1 && this.menuNumEntries > 0) {
                const action: number = this.menuAction[this.menuNumEntries - 1];

                if (
                    action == MiniMenuAction.INV_BUTTON1 || action == MiniMenuAction.INV_BUTTON2 || action == MiniMenuAction.INV_BUTTON3 || action == MiniMenuAction.INV_BUTTON4 || action == MiniMenuAction.INV_BUTTON5 ||
                    action == MiniMenuAction.OP_HELD1 || action == MiniMenuAction.OP_HELD2 || action == MiniMenuAction.OP_HELD3 || action == MiniMenuAction.OP_HELD4 || action == MiniMenuAction.OP_HELD5 ||
                    action == MiniMenuAction.USEHELD_START || action === MiniMenuAction.OP_HELD6
                ) {
                    const slot: number = this.menuParamB[this.menuNumEntries - 1];
                    const comId: number = this.menuParamC[this.menuNumEntries - 1];
                    const com = IfType.get(comId);

                    // Java: draggable || swappable
                    if (com && (com.objSwap || com.objReplace)) {
                        this.objGrabThreshold = false;
                        this.objDragCycles = 0;
                        this.objDragComId = comId;
                        this.objDragSlot = slot;
                        this.objDragArea = 2;
                        this.objGrabX = this.mouseClickX;
                        this.objGrabY = this.mouseClickY;

                        if (com.layerId === this.mainModalId) {
                            this.objDragArea = 1;
                        }

                        if (com.layerId === this.chatModalId) {
                            this.objDragArea = 3;
                        }

                        return;
                    }
                }
            }

            if (button === 1 && (this.oneMouseButton === 1 || this.isAddFriendOption(this.menuNumEntries - 1)) && this.menuNumEntries > 2) {
                button = 2;
            }

            if (button === 1 && this.menuNumEntries > 0) {
                this.useMenuOption(this.menuNumEntries - 1);
            } else if (button == 2 && this.menuNumEntries > 0) {
                this.showContextMenu();
            }
        }
    }

    private drawMenu(): void {
        const x: number = this.menuX;
        const y: number = this.menuY;
        const w: number = this.menuWidth;
        const h: number = this.menuHeight;
        const background: number = 0x5d5447;

        Pix2D.fillRect(x, y, w, h, background);
        Pix2D.fillRect(x + 1, y + 1, w - 2, 16, Colour.BLACK);
        Pix2D.drawRect(x + 1, y + 18, w - 2, h - 19, Colour.BLACK);

        this.b12?.drawString('Choose Option', x + 3, y + 14, background);

        let mouseX: number = this.mouseX;
        let mouseY: number = this.mouseY;
        if (this.menuArea === 0) {
            mouseX -= 4;
            mouseY -= 4;
        } else if (this.menuArea === 1) {
            mouseX -= 553;
            mouseY -= 205;
        } else if (this.menuArea === 2) {
            mouseX -= 17;
            mouseY -= 357;
        }

        for (let i: number = 0; i < this.menuNumEntries; i++) {
            const optionY: number = y + (this.menuNumEntries - 1 - i) * 15 + 31;

            let rgb: number = Colour.WHITE;
            if (mouseX > x && mouseX < x + w && mouseY > optionY - 13 && mouseY < optionY + 3) {
                rgb = Colour.YELLOW;
            }

            this.b12?.drawStringTag(this.menuOption[i], x + 3, optionY, rgb, true);
        }
    }

    private showPopupMessage(): void {
        if (this.menuNumEntries < 2 && this.useMode === 0 && this.targetMode === 0) {
            return;
        }

        let tooltip: string;
        if (this.useMode === 1 && this.menuNumEntries < 2) {
            tooltip = 'Use ' + this.objSelectedName + ' with...';
        } else if (this.targetMode === 1 && this.menuNumEntries < 2) {
            tooltip = this.targetOp + '...';
        } else {
            tooltip = this.menuOption[this.menuNumEntries - 1];
        }

        if (this.menuNumEntries > 2) {
            tooltip = tooltip + '@whi@ / ' + (this.menuNumEntries - 2) + ' more options';
        }

        this.b12?.drawStringAntiMacro(tooltip, 4, 15, Colour.WHITE, true, (Client.loopCycle / 1000) | 0);
    }

    private showContextMenu(): void {
        let width: number = 0;
        if (this.b12) {
            width = this.b12.stringWid('Choose Option');
            let maxWidth: number;
            for (let i: number = 0; i < this.menuNumEntries; i++) {
                maxWidth = this.b12.stringWid(this.menuOption[i]);
                if (maxWidth > width) {
                    width = maxWidth;
                }
            }
        }
        width += 8;

        const height: number = this.menuNumEntries * 15 + 21;

        let x: number;
        let y: number;

        if (this.mouseClickX > 4 && this.mouseClickY > 4 && this.mouseClickX < 516 && this.mouseClickY < 338) {
            x = this.mouseClickX - ((width / 2) | 0) - 4;
            if (x + width > 512) {
                x = 512 - width;
            }
            if (x < 0) {
                x = 0;
            }

            y = this.mouseClickY - 4;
            if (y + height > 334) {
                y = 334 - height;
            }
            if (y < 0) {
                y = 0;
            }

            this.isMenuOpen = true;
            this.menuArea = 0;
            this.menuX = x;
            this.menuY = y;
            this.menuWidth = width;
            this.menuHeight = this.menuNumEntries * 15 + 22;
        }

        // the sidebar/tabs area
        if (this.mouseClickX > 553 && this.mouseClickY > 205 && this.mouseClickX < 743 && this.mouseClickY < 466) {
            x = this.mouseClickX - ((width / 2) | 0) - 553;
            if (x < 0) {
                x = 0;
            } else if (x + width > 190) {
                x = 190 - width;
            }

            y = this.mouseClickY - 205;
            if (y < 0) {
                y = 0;
            } else if (y + height > 261) {
                y = 261 - height;
            }

            this.isMenuOpen = true;
            this.menuArea = 1;
            this.menuX = x;
            this.menuY = y;
            this.menuWidth = width;
            this.menuHeight = this.menuNumEntries * 15 + 22;
        }

        // the chatbox area
        if (this.mouseClickX > 17 && this.mouseClickY > 357 && this.mouseClickX < 496 && this.mouseClickY < 453) {
            x = this.mouseClickX - ((width / 2) | 0) - 17;
            if (x < 0) {
                x = 0;
            } else if (x + width > 479) {
                x = 479 - width;
            }

            y = this.mouseClickY - 357;
            if (y < 0) {
                y = 0;
            } else if (y + height > 96) {
                y = 96 - height;
            }

            this.isMenuOpen = true;
            this.menuArea = 2;
            this.menuX = x;
            this.menuY = y;
            this.menuWidth = width;
            this.menuHeight = this.menuNumEntries * 15 + 22;
        }
    }

    private isAddFriendOption(option: number): boolean {
        if (option < 0) {
            return false;
        }

        let action: number = this.menuAction[option];
        if (action >= MiniMenuAction._PRIORITY) {
            action -= MiniMenuAction._PRIORITY;
        }

        return action === MiniMenuAction.FRIENDLIST_ADD;
    }

    private useMenuOption(optionId: number): void {
        if (optionId < 0) {
            return;
        }

        let action: number = this.menuAction[optionId];
        const a: number = this.menuParamA[optionId];
        const b: number = this.menuParamB[optionId];
        const c: number = this.menuParamC[optionId];

        if (action >= MiniMenuAction._PRIORITY) {
            action -= MiniMenuAction._PRIORITY;
        }

        // Java 377 useMenuOption: clear chatback amount/name unless CANCEL (menuAction[0]).
        // 289 cleared dialogInputOpen unconditionally; 377 uses chatbackInputOpen + CANCEL skip.
        if (this.chatbackInputOpen !== 0 && action !== MiniMenuAction.CANCEL) {
            this.chatbackInputOpen = 0;
            this.dialogInputOpen = false;
            this.redrawChat = true;
        }

        if (action === MiniMenuAction.OP_OBJ1 || action === MiniMenuAction.OP_OBJ2 || action === MiniMenuAction.OP_OBJ3 || action === MiniMenuAction.OP_OBJ4 || action === MiniMenuAction.OP_OBJ5) {
            if (this.localPlayer) {
                const success: boolean = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 0, 0, 0, 0, 0, 2);
                if (!success) {
                    this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 1, 1, 0, 0, 0, 2);
                }

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpObjDecoder — each op shuffles x/z/obj alts differently.
                const worldX = b + this.mapBuildBaseX;
                const worldZ = c + this.mapBuildBaseZ;
                if (action === MiniMenuAction.OP_OBJ1) {
                    // Java 377 OPOBJ1: no anticheat
                    this.out.p1Enc(ClientProt.OPOBJ1);
                    this.out.p2_alt2(worldX);
                    this.out.p2(worldZ);
                    this.out.p2_alt3(a);
                }

                if (action === MiniMenuAction.OP_OBJ2) {
                    // Java 377: oplogic1++ / >=120 → ANTICHEAT_OPLOGIC1
                    Client.oplogic1++;
                    if (Client.oplogic1 >= 120) {
                        this.out.p1Enc(ClientProt.ANTICHEAT_OPLOGIC1);
                        this.out.p4(0);
                        Client.oplogic1 = 0;
                    }
                    this.out.p1Enc(ClientProt.OPOBJ2);
                    this.out.p2(worldX);
                    this.out.p2_alt2(worldZ);
                    this.out.p2_alt3(a);
                }

                if (action === MiniMenuAction.OP_OBJ3) {
                    // Java 377: (obj&3)==0 → oplogic4++; >=84 → ANTICHEAT_OPLOGIC4
                    if ((a & 0x3) === 0) {
                        Client.oplogic4++;
                    }
                    if (Client.oplogic4 >= 84) {
                        this.out.p1Enc(ClientProt.ANTICHEAT_OPLOGIC4);
                        this.out.p3(11257922);
                        Client.oplogic4 = 0;
                    }
                    this.out.p1Enc(ClientProt.OPOBJ3);
                    this.out.p2_alt3(a);
                    this.out.p2_alt3(worldX);
                    this.out.p2_alt2(worldZ);
                }

                if (action === MiniMenuAction.OP_OBJ4) {
                    // Java 377 OPOBJ4: no anticheat
                    this.out.p1Enc(ClientProt.OPOBJ4);
                    this.out.p2_alt2(a);
                    this.out.p2_alt1(worldZ);
                    this.out.p2(worldX);
                }

                if (action === MiniMenuAction.OP_OBJ5) {
                    // Java 377 OPOBJ5: no anticheat (oplogic3 is on OPNPC3)
                    this.out.p1Enc(ClientProt.OPOBJ5);
                    this.out.p2_alt1(a);
                    this.out.p2_alt2(worldX);
                    this.out.p2(worldZ);
                }
            }
        }

        if (action === MiniMenuAction.OP_OBJ6) {
            const obj: ObjType = ObjType.list(a);
            let examine: string;

            if (!obj.desc) {
                examine = "It's a " + obj.name + '.';
            } else {
                examine = obj.desc;
            }

            this.addMessage('', examine, 0);
        }

        if (action === MiniMenuAction.TGT_OBJ) {
            if (this.localPlayer) {
                const success: boolean = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 0, 0, 0, 0, 0, 2);
                if (!success) {
                    this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 1, 1, 0, 0, 0, 2);
                }

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpObjTDecoder: obj g2_alt1, z g2, spellCom g2_alt1, x g2_alt3
                this.out.p1Enc(ClientProt.OPOBJT);
                this.out.p2_alt1(a);
                this.out.p2(c + this.mapBuildBaseZ);
                this.out.p2_alt1(this.targetComId);
                this.out.p2_alt3(b + this.mapBuildBaseX);
            }
        }

        if (action === MiniMenuAction.USEHELD_ONOBJ) {
            if (this.localPlayer) {
                const success: boolean = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 0, 0, 0, 0, 0, 2);
                if (!success) {
                    this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 1, 1, 0, 0, 0, 2);
                }

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpObjUDecoder: useSlot, useObj, z, x, useCom, obj
                this.out.p1Enc(ClientProt.OPOBJU);
                this.out.p2_alt3(this.objSelectedSlot);
                this.out.p2_alt2(this.objComId);
                this.out.p2_alt3(c + this.mapBuildBaseZ);
                this.out.p2_alt3(b + this.mapBuildBaseX);
                this.out.p2_alt1(this.objSelectedComId);
                this.out.p2_alt1(a);
            }
        }

        if (action === MiniMenuAction.OP_NPC1 || action === MiniMenuAction.OP_NPC2 || action === MiniMenuAction.OP_NPC3 || action === MiniMenuAction.OP_NPC4 || action === MiniMenuAction.OP_NPC5) {
            const npc: ClientNpc | null = this.npc[a];
            if (npc && this.localPlayer) {
                this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpNpcDecoder — each op uses a different g2 alt on the slot
                if (action === MiniMenuAction.OP_NPC1) {
                    this.out.p1Enc(ClientProt.OPNPC1);
                    this.out.p2_alt1(a);
                }

                if (action === MiniMenuAction.OP_NPC2) {
                    this.out.p1Enc(ClientProt.OPNPC2);
                    this.out.p2_alt2(a);
                }

                if (action === MiniMenuAction.OP_NPC3) {
                    // Java 377: oplogic3 += npcSlot; >=143 → ANTICHEAT_OPLOGIC3
                    Client.oplogic3 += a;
                    if (Client.oplogic3 >= 143) {
                        this.out.p1Enc(ClientProt.ANTICHEAT_OPLOGIC3);
                        this.out.p4(0);
                        Client.oplogic3 = 0;
                    }
                    this.out.p1Enc(ClientProt.OPNPC3);
                    this.out.p2_alt3(a);
                }

                if (action === MiniMenuAction.OP_NPC4) {
                    this.out.p1Enc(ClientProt.OPNPC4);
                    this.out.p2_alt1(a);
                }

                if (action === MiniMenuAction.OP_NPC5) {
                    this.out.p1Enc(ClientProt.OPNPC5);
                    this.out.p2_alt1(a);
                }
            }
        }

        if (action === MiniMenuAction.OP_NPC6) {
            const npc: ClientNpc | null = this.npc[a];
            if (npc && npc.type) {
                const type = npc.type.activeType();
                if (type) {
                    let examine: string;

                    if (!type.desc) {
                        examine = "It's a " + type.name + '.';
                    } else {
                        examine = type.desc;
                    }

                    this.addMessage('', examine, 0);
                }
            }
        }

        if (action === MiniMenuAction.TGT_NPC) {
            const npc: ClientNpc | null = this.npc[a];
            if (npc && this.localPlayer) {
                this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpNpcTDecoder: spellCom g2_alt2, npcSlot g2_alt1
                this.out.p1Enc(ClientProt.OPNPCT);
                this.out.p2_alt2(this.targetComId);
                this.out.p2_alt1(a);
            }
        }

        if (action === MiniMenuAction.USEHELD_ONNPC) {
            const npc: ClientNpc | null = this.npc[a];

            if (npc && this.localPlayer) {
                this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpNpcUDecoder: npcSlot g2, useObj g2_alt1, useCom g2_alt3, useSlot g2
                this.out.p1Enc(ClientProt.OPNPCU);
                this.out.p2(a);
                this.out.p2_alt1(this.objComId);
                this.out.p2_alt3(this.objSelectedComId);
                this.out.p2(this.objSelectedSlot);
            }
        }

        // Java 377 OPLOC1–5: interactWithLoc then always write packet (ignore path result).
        if (action === MiniMenuAction.OP_LOC1) {
            this.interactWithLoc(b, c, a);
            this.writeOpLoc(ClientProt.OPLOC1, b, c, a);
        }

        if (action === MiniMenuAction.OP_LOC2) {
            this.interactWithLoc(b, c, a);
            this.writeOpLoc(ClientProt.OPLOC2, b, c, a);
        }

        if (action === MiniMenuAction.OP_LOC3) {
            this.interactWithLoc(b, c, a);
            this.writeOpLoc(ClientProt.OPLOC3, b, c, a);
        }

        if (action === MiniMenuAction.OP_LOC4) {
            this.interactWithLoc(b, c, a);
            this.writeOpLoc(ClientProt.OPLOC4, b, c, a);
        }

        if (action === MiniMenuAction.OP_LOC5) {
            this.interactWithLoc(b, c, a);
            this.writeOpLoc(ClientProt.OPLOC5, b, c, a);
        }

        if (action === MiniMenuAction.OP_LOC6) {
            const locId: number = (a >> 14) & 0x7fff;
            const loc: LocType = LocType.list(locId);

            let examine: string;
            if (!loc.desc) {
                examine = "It's a " + loc.name + '.';
            } else {
                examine = loc.desc;
            }

            this.addMessage('', examine, 0);
        }

        if (action === MiniMenuAction.TGT_LOC) {
            if (this.interactWithLoc(b, c, a, ClientProt.OPLOCT)) {
                // Engine OpLocTDecoder: spellCom g2, loc g2_alt1, x g2_alt2, z g2_alt1
                const locId = (a >> 14) & 0x7fff;
                this.out.p1Enc(ClientProt.OPLOCT);
                this.out.p2(this.targetComId);
                this.out.p2_alt1(locId);
                this.out.p2_alt2(b + this.mapBuildBaseX);
                this.out.p2_alt1(c + this.mapBuildBaseZ);
            }
        }

        if (action === MiniMenuAction.USEHELD_ONLOC) {
            if (this.interactWithLoc(b, c, a, ClientProt.OPLOCU)) {
                // Engine OpLocUDecoder: loc, useCom, useObj, z, useSlot, x
                const locId = (a >> 14) & 0x7fff;
                this.out.p1Enc(ClientProt.OPLOCU);
                this.out.p2_alt1(locId);
                this.out.p2_alt1(this.objSelectedComId);
                this.out.p2_alt1(this.objComId);
                this.out.p2_alt1(c + this.mapBuildBaseZ);
                this.out.p2(this.objSelectedSlot);
                this.out.p2_alt3(b + this.mapBuildBaseX);
            }
        }

        if (action === MiniMenuAction.OP_PLAYER1 || action === MiniMenuAction.OP_PLAYER2 || action === MiniMenuAction.OP_PLAYER3 || action === MiniMenuAction.OP_PLAYER4 || action === MiniMenuAction.OP_PLAYER5) {
            const player: ClientPlayer | null = this.players[a];
            if (player && this.localPlayer) {
                this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpPlayerDecoder — each op uses a different g2 alt on the slot.
                // Java 377 OPPLAYER*: no oplogic anticheat (oplogic4/5 are on OPOBJ3 / OPHELD1).
                if (action === MiniMenuAction.OP_PLAYER1) {
                    this.out.p1Enc(ClientProt.OPPLAYER1);
                    this.out.p2_alt3(a);
                }

                if (action === MiniMenuAction.OP_PLAYER2) {
                    this.out.p1Enc(ClientProt.OPPLAYER2);
                    this.out.p2_alt2(a);
                }

                if (action === MiniMenuAction.OP_PLAYER3) {
                    this.out.p1Enc(ClientProt.OPPLAYER3);
                    this.out.p2_alt1(a);
                }

                if (action === MiniMenuAction.OP_PLAYER4) {
                    this.out.p1Enc(ClientProt.OPPLAYER4);
                    this.out.p2_alt1(a);
                }

                if (action === MiniMenuAction.OP_PLAYER5) {
                    this.out.p1Enc(ClientProt.OPPLAYER5);
                    this.out.p2_alt2(a);
                }
            }
        }

        if (action === MiniMenuAction.ACCEPT_TRADEREQ || action === MiniMenuAction.ACCEPT_DUELREQ) {
            // Java 377 actions 544 (trade→OPPLAYER4) / 695 (duel→OPPLAYER1): no anticheat
            let option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                option = option.substring(tag + 5).trim();
                const name: string = JString.toScreenName(JString.toRawUsername(JString.toUserhash(option)));
                let found: boolean = false;

                for (let i: number = 0; i < this.playerCount; i++) {
                    const player: ClientPlayer | null = this.players[this.playerIds[i]];

                    if (player && player.name && player.name.toLowerCase() === name.toLowerCase() && this.localPlayer) {
                        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                        if (action === MiniMenuAction.ACCEPT_TRADEREQ) {
                            this.out.p1Enc(ClientProt.OPPLAYER4);
                            this.out.p2_alt1(this.playerIds[i]);
                        }

                        if (action === MiniMenuAction.ACCEPT_DUELREQ) {
                            this.out.p1Enc(ClientProt.OPPLAYER1);
                            this.out.p2_alt3(this.playerIds[i]);
                        }

                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.addMessage('', 'Unable to find ' + name, 0);
                }
            }
        }

        if (action === MiniMenuAction.TGT_PLAYER) {
            const player: ClientPlayer | null = this.players[a];

            if (player && this.localPlayer) {
                this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpPlayerTDecoder: playerSlot g2, spellCom g2_alt1
                this.out.p1Enc(ClientProt.OPPLAYERT);
                this.out.p2(a);
                this.out.p2_alt1(this.targetComId);
            }
        }

        if (action === MiniMenuAction.USEHELD_ONPLAYER) {
            const player: ClientPlayer | null = this.players[a];
            if (player && this.localPlayer) {
                this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // Engine OpPlayerUDecoder: useObj, useSlot, useCom, playerSlot
                this.out.p1Enc(ClientProt.OPPLAYERU);
                this.out.p2_alt1(this.objComId);
                this.out.p2_alt3(this.objSelectedSlot);
                this.out.p2(this.objSelectedComId);
                this.out.p2_alt2(a);
            }
        }

        if (action === MiniMenuAction.OP_HELD1 || action === MiniMenuAction.OP_HELD2 || action === MiniMenuAction.OP_HELD3 || action === MiniMenuAction.OP_HELD4 || action === MiniMenuAction.OP_HELD5) {
            // Engine OpHeldDecoder — a=obj, b=slot, c=com; each op shuffles field order + alts
            if (action === MiniMenuAction.OP_HELD1) {
                // Java 377: oplogic5 += obj; >=115 → ANTICHEAT_OPLOGIC5 p1(125)
                Client.oplogic5 += a;
                if (Client.oplogic5 >= 115) {
                    this.out.p1Enc(ClientProt.ANTICHEAT_OPLOGIC5);
                    this.out.p1(125);
                    Client.oplogic5 = 0;
                }
                this.out.p1Enc(ClientProt.OPHELD1);
                this.out.p2_alt2(c);
                this.out.p2_alt1(b);
                this.out.p2_alt1(a);
            }

            if (action === MiniMenuAction.OP_HELD2) {
                this.out.p1Enc(ClientProt.OPHELD2);
                this.out.p2_alt1(c);
                this.out.p2_alt1(a);
                this.out.p2_alt2(b);
            }

            if (action === MiniMenuAction.OP_HELD3) {
                this.out.p1Enc(ClientProt.OPHELD3);
                this.out.p2_alt3(b);
                this.out.p2_alt3(a);
                this.out.p2_alt1(c);
            }

            if (action === MiniMenuAction.OP_HELD4) {
                // Java 377: oplogic2++; >=62 → ANTICHEAT_OPLOGIC2 p1(206)
                Client.oplogic2++;
                if (Client.oplogic2 >= 62) {
                    this.out.p1Enc(ClientProt.ANTICHEAT_OPLOGIC2);
                    this.out.p1(206);
                    Client.oplogic2 = 0;
                }
                this.out.p1Enc(ClientProt.OPHELD4);
                this.out.p2_alt1(b);
                this.out.p2_alt2(a);
                this.out.p2(c);
            }

            if (action === MiniMenuAction.OP_HELD5) {
                this.out.p1Enc(ClientProt.OPHELD5);
                this.out.p2_alt1(b);
                this.out.p2_alt3(a);
                this.out.p2_alt3(c);
            }

            this.selectedCycle = 0;
            this.selectedComId = c;
            this.selectedItem = b;
            this.selectedArea = 2;
            this.setSelectedAreaFromCom(c);
        }

        if (action === MiniMenuAction.OP_HELD6) {
            const obj: ObjType = ObjType.list(a);
            const com = IfType.get(c);
            let examine: string;

            if (com && com.linkObjNumber && com.linkObjNumber[b] >= 100000) {
                examine = com.linkObjNumber[b] + ' x ' + obj.name;
            } else if (!obj.desc) {
                examine = "It's a " + obj.name + '.';
            } else {
                examine = obj.desc;
            }

            this.addMessage('', examine, 0);
        }

        if (action === MiniMenuAction.USEHELD_START) {
            this.useMode = 1;
            this.objSelectedSlot = b;
            this.objSelectedComId = c;
            this.objComId = a;
            this.objSelectedName = ObjType.list(a).name;
            this.targetMode = 0;
            this.redrawSide = true;
            return;
        }

        if (action === MiniMenuAction.TGT_BUTTON) {
            // Java 377 action 70: spellSelected
            const com = IfType.get(c);
            if (!com) {
                return;
            }
            this.targetMode = 1;
            this.targetComId = c;
            this.targetMask = com.targetMask;
            this.useMode = 0;
            this.redrawSide = true;

            let prefix: string | null = com.targetVerb;
            if (prefix && prefix.indexOf(' ') !== -1) {
                prefix = prefix.substring(0, prefix.indexOf(' '));
            }

            let suffix: string | null = com.targetVerb;
            if (suffix && suffix.indexOf(' ') !== -1) {
                suffix = suffix.substring(suffix.indexOf(' ') + 1);
            }

            this.targetOp = prefix + ' ' + com.targetBase + ' ' + suffix;

            if (this.targetMask === 0x10) {
                this.redrawSide = true;
                this.activeIcon = 3;
                this.redrawIcons = true;
            }

            return;
        }

        if (action === MiniMenuAction.TGT_HELD) {
            // Engine OpHeldTDecoder: spellCom g2, com g2_alt2, slot g2_alt2, obj g2_alt2
            this.out.p1Enc(ClientProt.OPHELDT);
            this.out.p2(this.targetComId);
            this.out.p2_alt2(c);
            this.out.p2_alt2(b);
            this.out.p2_alt2(a);

            this.selectedCycle = 0;
            this.selectedComId = c;
            this.selectedItem = b;
            this.selectedArea = 2;
            this.setSelectedAreaFromCom(c);
        }

        if (action === MiniMenuAction.USEHELD_ONHELD) {
            // Engine OpHeldUDecoder: obj, useSlot, useObj, useCom, slot, com
            // Java objInterface = selected obj id (TS objComId), objSelectedInterface = com (TS objSelectedComId)
            this.out.p1Enc(ClientProt.OPHELDU);
            this.out.p2(a);
            this.out.p2_alt1(this.objSelectedSlot);
            this.out.p2_alt1(this.objComId);
            this.out.p2_alt3(this.objSelectedComId);
            this.out.p2_alt2(b);
            this.out.p2_alt2(c);

            this.selectedCycle = 0;
            this.selectedComId = c;
            this.selectedItem = b;
            this.selectedArea = 2;
            this.setSelectedAreaFromCom(c);
        }

        if (action === MiniMenuAction.INV_BUTTON1 || action === MiniMenuAction.INV_BUTTON2 || action === MiniMenuAction.INV_BUTTON3 || action === MiniMenuAction.INV_BUTTON4 || action === MiniMenuAction.INV_BUTTON5) {
            // Java 377 INV_BUTTON1–5 ≡ engine InvButtonDecoder (a=obj, b=slot, c=com)
            // No anticheat on INV_BUTTON in 377 (289 had OPLOGIC6 on button1).
            if (action === MiniMenuAction.INV_BUTTON1) {
                this.out.p1Enc(ClientProt.INV_BUTTON1);
                this.out.p2_alt2(a);
                this.out.p2(c);
                this.out.p2(b);
            }

            if (action === MiniMenuAction.INV_BUTTON2) {
                this.out.p1Enc(ClientProt.INV_BUTTON2);
                this.out.p2_alt2(b);
                this.out.p2_alt1(a);
                this.out.p2_alt1(c);
            }

            if (action === MiniMenuAction.INV_BUTTON3) {
                this.out.p1Enc(ClientProt.INV_BUTTON3);
                this.out.p2_alt1(a);
                this.out.p2_alt3(b);
                this.out.p2(c);
            }

            if (action === MiniMenuAction.INV_BUTTON4) {
                this.out.p1Enc(ClientProt.INV_BUTTON4);
                this.out.p2_alt3(c);
                this.out.p2_alt1(b);
                this.out.p2(a);
            }

            if (action === MiniMenuAction.INV_BUTTON5) {
                this.out.p1Enc(ClientProt.INV_BUTTON5);
                this.out.p2_alt3(b);
                this.out.p2_alt3(a);
                this.out.p2_alt1(c);
            }

            this.selectedCycle = 0;
            this.selectedComId = c;
            this.selectedItem = b;
            this.selectedArea = 2;
            this.setSelectedAreaFromCom(c);
        }

        if (action === MiniMenuAction.IF_BUTTON) {
            // Java 377 action 352: clientCode → handleInterfaceAction; may suppress IF_BUTTON
            const com = IfType.get(c);
            let notify: boolean = true;

            if (com && com.clientCode > 0) {
                notify = this.handleInterfaceAction(com);
            }

            if (notify) {
                this.out.p1Enc(ClientProt.IF_BUTTON);
                this.out.p2(c);
            }
        }

        if (action === MiniMenuAction.TOGGLE_BUTTON) {
            // Java 377 action 890: IF_BUTTON + toggle varp from scripts[0] op5
            this.out.p1Enc(ClientProt.IF_BUTTON);
            this.out.p2(c);

            const com = IfType.get(c);
            if (com && com.scripts && com.scripts[0] && com.scripts[0][0] === 5) {
                const varp: number = com.scripts[0][1];
                this.var[varp] = 1 - this.var[varp];
                this.updateVarp(varp);
                this.redrawSide = true;
            }
        }

        if (action === MiniMenuAction.SELECT_BUTTON) {
            // Java 377 action 518: IF_BUTTON + set varp to scriptOperand[0]
            this.out.p1Enc(ClientProt.IF_BUTTON);
            this.out.p2(c);

            const com = IfType.get(c);
            if (com && com.scripts && com.scripts[0] && com.scripts[0][0] === 5) {
                const varp: number = com.scripts[0][1];
                if (com.scriptOperand && this.var[varp] !== com.scriptOperand[0]) {
                    this.var[varp] = com.scriptOperand[0];
                    this.updateVarp(varp);
                    this.redrawSide = true;
                }
            }
        }

        if (action === MiniMenuAction.PAUSE_BUTTON) {
            // Java 377 action 575: RESUME_PAUSEBUTTON p2(com) once until IF reopen clears flag
            if (!this.resumedPauseButton) {
                this.out.p1Enc(ClientProt.RESUME_PAUSEBUTTON);
                this.out.p2(c);
                this.resumedPauseButton = true;
            }
        }

        if (action === MiniMenuAction.CLOSE_BUTTON) {
            // Java: area==3 sticky close (action 55) → unload stickyChatInterfaceId only
            //      else action 639 → closeInterfaces(). We encode sticky via menuParamA===1.
            if (a === 1 && this.tutComId !== -1) {
                this.unloadCom(this.tutComId);
                this.tutComId = -1;
                this.redrawChat = true;
            } else {
                this.closeInterfaces();
            }
        }

        if (action === MiniMenuAction.ABUSE_REPORT) {
            // Java 377 action 507: only open report when no main modal; else chat warning
            const option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                if (this.mainModalId === -1) {
                    this.closeInterfaces();

                    this.reportAbuseInput = option.substring(tag + 5).trim();
                    this.reportAbuseMuteOption = false;

                    for (let i: number = 0; i < IfType.list.length; i++) {
                        if (IfType.get(i) && IfType.get(i)!.clientCode === ClientCode.CC_REPORT_INPUT) {
                            this.reportAbuseComId = this.mainModalId = IfType.get(i)!.layerId;
                            break;
                        }
                    }
                } else {
                    this.addMessage('', "Please close the interface you have open before using 'report abuse'", 0);
                }
            }
        }

        if (action === MiniMenuAction.WALK) {
            if (this.isMenuOpen) {
                this.world?.updateMousePicking(b - 4, c - 4);
            } else {
                this.world?.updateMousePicking(this.mouseClickX - 4, this.mouseClickY - 4);
            }
        }

        if (action === MiniMenuAction.FRIENDLIST_ADD || action === MiniMenuAction.IGNORELIST_ADD || action === MiniMenuAction.FRIENDLIST_DEL || action === MiniMenuAction.IGNORELIST_DEL) {
            const option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                const username: bigint = JString.toUserhash(option.substring(tag + 5).trim());
                if (action === MiniMenuAction.FRIENDLIST_ADD) {
                    this.addFriend(username);
                } else if (action === MiniMenuAction.IGNORELIST_ADD) {
                    this.addIgnore(username);
                } else if (action === MiniMenuAction.FRIENDLIST_DEL) {
                    this.removeFriend(username);
                } else if (action === MiniMenuAction.IGNORELIST_DEL) {
                    this.removeIgnore(username);
                }
            }
        }

        if (action === MiniMenuAction.MESSAGE_PRIVATE) {
            const option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                const userhash: bigint = JString.toUserhash(option.substring(tag + 5).trim());
                let friend: number = -1;

                for (let i: number = 0; i < this.friendCount; i++) {
                    if (this.friendUserhash[i] === userhash) {
                        friend = i;
                        break;
                    }
                }

                if (friend !== -1 && this.friendNodeId[friend] > 0) {
                    this.redrawChat = true;
                    this.dialogInputOpen = false;
                    this.socialInputOpen = true;
                    this.socialInput = '';
                    this.socialInputType = 3;
                    this.socialUserhash = this.friendUserhash[friend];
                    this.socialInputHeader = 'Enter message to send to ' + this.friendUsername[friend];
                }
            }
        }

        this.useMode = 0;
        this.targetMode = 0;
        this.redrawSide = true;
    }

    private handleViewportOptions(): void {
        if (this.useMode === 0 && this.targetMode === 0) {
            this.menuOption[this.menuNumEntries] = 'Walk here';
            this.menuAction[this.menuNumEntries] = MiniMenuAction.WALK;
            this.menuParamB[this.menuNumEntries] = this.mouseX;
            this.menuParamC[this.menuNumEntries] = this.mouseY;
            this.menuNumEntries++;
        }

        let lastTypecode: number = -1;
        for (let picked: number = 0; picked < Model.pickedCount; picked++) {
            const typecode: number = Model.pickedEntityTypecode[picked];
            const x: number = typecode & 0x7f;
            const z: number = (typecode >> 7) & 0x7f;
            const entityType: number = (typecode >> 29) & 0x3;
            const typeId: number = (typecode >> 14) & 0x7fff;

            if (typecode === lastTypecode) {
                continue;
            }

            lastTypecode = typecode;

            if (entityType === 2 && this.world && this.world.typeCode2(this.minusedlevel, x, z, typecode) >= 0) {
                // Java Client menu: LocType.method561; if field1659 != null then method562
                let loc: LocType | null = LocType.list(typeId);
                if (loc.multiloc !== null) {
                    loc = loc.getMultiLoc();
                }
                if (loc === null) {
                    continue;
                }

                if (this.useMode === 1) {
                    this.menuOption[this.menuNumEntries] = 'Use ' + this.objSelectedName + ' with @cya@' + loc.name;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.USEHELD_ONLOC;
                    this.menuParamA[this.menuNumEntries] = typecode;
                    this.menuParamB[this.menuNumEntries] = x;
                    this.menuParamC[this.menuNumEntries] = z;
                    this.menuNumEntries++;
                } else if (this.targetMode === 1) {
                    if ((this.targetMask & 0x4) === 4) {
                        this.menuOption[this.menuNumEntries] = this.targetOp + ' @cya@' + loc.name;
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.TGT_LOC;
                        this.menuParamA[this.menuNumEntries] = typecode;
                        this.menuParamB[this.menuNumEntries] = x;
                        this.menuParamC[this.menuNumEntries] = z;
                        this.menuNumEntries++;
                    }
                } else {
                    if (loc.op) {
                        for (let i: number = 4; i >= 0; i--) {
                            if (loc.op[i] === null) {
                                continue;
                            }

                            this.menuOption[this.menuNumEntries] = loc.op[i] + ' @cya@' + loc.name;

                            if (i === 0) {
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_LOC1;
                            } else if (i === 1) {
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_LOC2;
                            } else if (i === 2) {
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_LOC3;
                            } else if (i === 3) {
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_LOC4;
                            } else if (i === 4) {
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_LOC5;
                            }

                            this.menuParamA[this.menuNumEntries] = typecode;
                            this.menuParamB[this.menuNumEntries] = x;
                            this.menuParamC[this.menuNumEntries] = z;
                            this.menuNumEntries++;
                        }
                    }

                    this.menuOption[this.menuNumEntries] = 'Examine @cya@' + loc.name;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_LOC6;
                    this.menuParamA[this.menuNumEntries] = typecode;
                    this.menuParamB[this.menuNumEntries] = x;
                    this.menuParamC[this.menuNumEntries] = z;
                    this.menuNumEntries++;
                }
            } else if (entityType === 1) {
                const npc: ClientNpc | null = this.npc[typeId];

                // Java: co-located size-1 npcs use base size (field1148 from spawn); menu resolve is inside addNpcOptions
                if (npc && npc.type && npc.type.size === 1 && (npc.x & 0x7f) === 64 && (npc.z & 0x7f) === 64) {
                    for (let i: number = 0; i < this.npcCount; i++) {
                        const other: ClientNpc | null = this.npc[this.npcIds[i]];

                        if (other && other !== npc && other.type && other.type.size === 1 && other.x === npc.x && other.z === npc.z) {
                            this.addNpcOptions(other.type, this.npcIds[i], x, z);
                        }
                    }
                }

                if (npc && npc.type) {
                    // Java passes base type; addNpcOptions does method476
                    this.addNpcOptions(npc.type, typeId, x, z);
                }
            } else if (entityType === 0) {
                const player: ClientPlayer | null = this.players[typeId];

                if (player && (player.x & 0x7f) === 64 && (player.z & 0x7f) === 64) {
                    for (let i: number = 0; i < this.npcCount; i++) {
                        const other: ClientNpc | null = this.npc[this.npcIds[i]];

                        if (other && other.type && other.type.size === 1 && other.x === player.x && other.z === player.z) {
                            this.addNpcOptions(other.type, this.npcIds[i], x, z);
                        }
                    }

                    for (let i: number = 0; i < this.playerCount; i++) {
                        const other: ClientPlayer | null = this.players[this.playerIds[i]];

                        if (other && other !== player && other.x === player.x && other.z === player.z) {
                            this.addPlayerOptions(other, this.playerIds[i], x, z);
                        }
                    }
                }

                if (player) {
                    this.addPlayerOptions(player, typeId, x, z);
                }
            } else if (entityType === 3) {
                const objs = this.groundObj[this.minusedlevel][x][z];
                if (!objs) {
                    continue;
                }

                for (let obj = objs.tail(); obj !== null; obj = objs.prev()) {
                    const type: ObjType = ObjType.list(obj.id);
                    if (this.useMode === 1) {
                        this.menuOption[this.menuNumEntries] = 'Use ' + this.objSelectedName + ' with @lre@' + type.name;
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.USEHELD_ONOBJ;
                        this.menuParamA[this.menuNumEntries] = obj.id;
                        this.menuParamB[this.menuNumEntries] = x;
                        this.menuParamC[this.menuNumEntries] = z;
                        this.menuNumEntries++;
                    } else if (this.targetMode === 1) {
                        if ((this.targetMask & 0x1) === 1) {
                            this.menuOption[this.menuNumEntries] = this.targetOp + ' @lre@' + type.name;
                            this.menuAction[this.menuNumEntries] = MiniMenuAction.TGT_OBJ;
                            this.menuParamA[this.menuNumEntries] = obj.id;
                            this.menuParamB[this.menuNumEntries] = x;
                            this.menuParamC[this.menuNumEntries] = z;
                            this.menuNumEntries++;
                        }
                    } else {
                        for (let op: number = 4; op >= 0; op--) {
                            if (type.op && type.op[op]) {
                                this.menuOption[this.menuNumEntries] = type.op[op] + ' @lre@' + type.name;

                                if (op === 0) {
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ1;
                                } else if (op === 1) {
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ2;
                                } else if (op === 2) {
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ3;
                                } else if (op === 3) {
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ4;
                                } else if (op === 4) {
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ5;
                                }

                                this.menuParamA[this.menuNumEntries] = obj.id;
                                this.menuParamB[this.menuNumEntries] = x;
                                this.menuParamC[this.menuNumEntries] = z;
                                this.menuNumEntries++;
                            } else if (op === 2) {
                                this.menuOption[this.menuNumEntries] = 'Take @lre@' + type.name;
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ3;
                                this.menuParamA[this.menuNumEntries] = obj.id;
                                this.menuParamB[this.menuNumEntries] = x;
                                this.menuParamC[this.menuNumEntries] = z;
                                this.menuNumEntries++;
                            }
                        }

                        this.menuOption[this.menuNumEntries] = 'Examine @lre@' + type.name;
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_OBJ6;
                        this.menuParamA[this.menuNumEntries] = obj.id;
                        this.menuParamB[this.menuNumEntries] = x;
                        this.menuParamC[this.menuNumEntries] = z;
                        this.menuNumEntries++;
                    }
                }
            }
        }
    }

    /**
     * Java 377 `addNpcOptions` — method476 multi resolve + field1434 active gate.
     * Callers pass the *map spawn* (base) type; resolve happens here.
     */
    private addNpcOptions(npc: NpcType, a: number, b: number, c: number): void {
        if (this.menuNumEntries >= 400) {
            return;
        }

        // Java: if field1425 != null then method476(); null → return; !field1434 → return
        if (npc.multinpc) {
            const multi = npc.getMultiNpc();
            if (!multi) {
                return;
            }
            npc = multi;
        }
        if (!npc.active) {
            return;
        }

        let tooltip: string | null = npc.name;
        if (npc.vislevel !== 0 && this.localPlayer) {
            tooltip = tooltip + this.getCombatLevelTag(this.localPlayer.combatLevel, npc.vislevel) + ' (level-' + npc.vislevel + ')';
        }

        if (this.useMode === 1) {
            this.menuOption[this.menuNumEntries] = 'Use ' + this.objSelectedName + ' with @yel@' + tooltip;
            this.menuAction[this.menuNumEntries] = MiniMenuAction.USEHELD_ONNPC;
            this.menuParamA[this.menuNumEntries] = a;
            this.menuParamB[this.menuNumEntries] = b;
            this.menuParamC[this.menuNumEntries] = c;
            this.menuNumEntries++;
        } else if (this.targetMode === 1) {
            if ((this.targetMask & 0x2) === 2) {
                this.menuOption[this.menuNumEntries] = this.targetOp + ' @yel@' + tooltip;
                this.menuAction[this.menuNumEntries] = MiniMenuAction.TGT_NPC;
                this.menuParamA[this.menuNumEntries] = a;
                this.menuParamB[this.menuNumEntries] = b;
                this.menuParamC[this.menuNumEntries] = c;
                this.menuNumEntries++;
            }
        } else {
            if (npc.op) {
                for (let i = 4; i >= 0; i--) {
                    if (npc.op[i] === null || npc.op[i]?.toLowerCase() === 'attack') {
                        continue;
                    }

                    this.menuOption[this.menuNumEntries] = npc.op[i] + ' @yel@' + tooltip;

                    if (i === 0) {
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_NPC1;
                    } else if (i === 1) {
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_NPC2;
                    } else if (i === 2) {
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_NPC3;
                    } else if (i === 3) {
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_NPC4;
                    } else if (i === 4) {
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_NPC5;
                    }

                    this.menuParamA[this.menuNumEntries] = a;
                    this.menuParamB[this.menuNumEntries] = b;
                    this.menuParamC[this.menuNumEntries] = c;
                    this.menuNumEntries++;
                }
            }

            if (npc.op) {
                for (let i = 4; i >= 0; i--) {
                    if (npc.op[i] === null || npc.op[i]?.toLowerCase() !== 'attack') {
                        continue;
                    }

                    let priority: number = 0;
                    if (this.localPlayer && npc.vislevel > this.localPlayer.combatLevel) {
                        priority = MiniMenuAction._PRIORITY;
                    }

                    this.menuOption[this.menuNumEntries] = npc.op[i] + ' @yel@' + tooltip;

                    if (i === 0) {
                        this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_NPC1;
                    } else if (i === 1) {
                        this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_NPC2;
                    } else if (i === 2) {
                        this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_NPC3;
                    } else if (i === 3) {
                        this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_NPC4;
                    } else if (i === 4) {
                        this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_NPC5;
                    }

                    this.menuParamA[this.menuNumEntries] = a;
                    this.menuParamB[this.menuNumEntries] = b;
                    this.menuParamC[this.menuNumEntries] = c;
                    this.menuNumEntries++;
                }
            }

            this.menuOption[this.menuNumEntries] = 'Examine @yel@' + tooltip;
            this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_NPC6;
            this.menuParamA[this.menuNumEntries] = a;
            this.menuParamB[this.menuNumEntries] = b;
            this.menuParamC[this.menuNumEntries] = c;
            this.menuNumEntries++;
        }
    }

    private addPlayerOptions(player: ClientPlayer, a: number, b: number, c: number): void {
        if (player === this.localPlayer || this.menuNumEntries >= 400) {
            return;
        }

        let tooltip: string | null = null;
        if (player.skillLevel === 0 && this.localPlayer) {
            tooltip = player.name + this.getCombatLevelTag(this.localPlayer.combatLevel, player.combatLevel) + ' (level-' + player.combatLevel + ')';
        } else {
            tooltip = player.name + ' (skill-' + player.skillLevel + ')';
        }

        if (this.useMode === 1) {
            this.menuOption[this.menuNumEntries] = 'Use ' + this.objSelectedName + ' with @whi@' + tooltip;
            this.menuAction[this.menuNumEntries] = MiniMenuAction.USEHELD_ONPLAYER;
            this.menuParamA[this.menuNumEntries] = a;
            this.menuParamB[this.menuNumEntries] = b;
            this.menuParamC[this.menuNumEntries] = c;
            this.menuNumEntries++;
        } else if (this.targetMode === 1) {
            if ((this.targetMask & 0x8) === 8) {
                this.menuOption[this.menuNumEntries] = this.targetOp + ' @whi@' + tooltip;
                this.menuAction[this.menuNumEntries] = MiniMenuAction.TGT_PLAYER;
                this.menuParamA[this.menuNumEntries] = a;
                this.menuParamB[this.menuNumEntries] = b;
                this.menuParamC[this.menuNumEntries] = c;
                this.menuNumEntries++;
            }
        } else {
            for (let i = 4; i >= 0; i--) {
                const op = this.playerOp[i];
                if (op === null || !this.localPlayer) {
                    continue;
                }

                this.menuOption[this.menuNumEntries] = op + ' @whi@' + tooltip;

                let priority = 0;
                if (op.toLowerCase() === 'attack') {
                    if (player.combatLevel > this.localPlayer.combatLevel) {
                        priority = MiniMenuAction._PRIORITY;
                    }

                    if (this.localPlayer.team !== 0 && player.team !== 0) {
                        if (this.localPlayer.team === player.team) {
                            priority = MiniMenuAction._PRIORITY;
                        } else {
                            priority = 0;
                        }
                    }
                } else if (this.playerOpPriority[i]) {
                    priority = MiniMenuAction._PRIORITY;
                }

                if (i === 0) {
                    this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_PLAYER1;
                } else if (i === 1) {
                    this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_PLAYER2;
                } else if (i === 2) {
                    this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_PLAYER3;
                } else if (i === 3) {
                    this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_PLAYER4;
                } else if (i === 4) {
                    this.menuAction[this.menuNumEntries] = priority + MiniMenuAction.OP_PLAYER5;
                }

                this.menuParamA[this.menuNumEntries] = a;
                this.menuParamB[this.menuNumEntries] = b;
                this.menuParamC[this.menuNumEntries] = c;
                this.menuNumEntries++;
            }
        }

        for (let i: number = 0; i < this.menuNumEntries; i++) {
            if (this.menuAction[i] === MiniMenuAction.WALK) {
                this.menuOption[i] = 'Walk here @whi@' + tooltip;
                break;
            }
        }
    }

    // todo: order
    /** Java `handleInterfaceInput` — menu options + hover + type-8 tooltip id. */
    /**
     * Java `handleInterfaceInput(y, com, area, scroll, x, mouseX, mouseY)`.
     * `area`: 0 viewport/fullscreen, 1 sidebar, 2 chat modal, 3 sticky chat (tutComId).
     * Sticky close (Java menuAction 55) unloads sticky only; other areas close all modals (639).
     */
    private handleInterfaceInput(com: IfType | null, mouseX: number, mouseY: number, x: number, y: number, scrollPosition: number, area: number = 0): void {
        if (!com || com.type !== 0 || !com.children || com.hide || mouseX < x || mouseY < y || mouseX > x + com.width || mouseY > y + com.height || !com.childX || !com.childY) {
            return;
        }

        const children: number = com.children.length;
        for (let i: number = 0; i < children; i++) {
            let childX: number = com.childX[i] + x;
            let childY: number = com.childY[i] + y - scrollPosition;
            const child = IfType.get(com.children[i]);
            if (!child) {
                continue;
            }

            childX += child.x;
            childY += child.y;

            if ((child.overLayerId >= 0 || child.colourOver !== 0) && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                if (child.overLayerId >= 0) {
                    this.lastOverComId = child.overLayerId;
                } else {
                    this.lastOverComId = child.id;
                }
            }

            // Java: type == 8 hover → field611 = id (tooltip target)
            if (child.type === ComponentType.TYPE_TEXT_STATIC && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                this.tooltipHoverComId = child.id;
            }

            if (child.type === ComponentType.TYPE_LAYER) {
                this.handleInterfaceInput(child, mouseX, mouseY, childX, childY, child.scrollPos, area);

                if (child.scrollHeight > child.height) {
                    this.handleScrollInput(mouseX, mouseY, child.scrollHeight, child.height, true, childX + child.width, childY, child);
                }
            } else {
                // Java: buttonType checks run for non-layer children (independent of type==2)
                if (child.buttonType === ButtonType.BUTTON_OK && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                    let override: boolean = false;
                    if (child.clientCode !== 0) {
                        override = this.handleSocialMenuOption(child);
                    }

                    if (!override && child.buttonText) {
                        this.menuOption[this.menuNumEntries] = child.buttonText;
                        this.menuAction[this.menuNumEntries] = MiniMenuAction.IF_BUTTON;
                        this.menuParamC[this.menuNumEntries] = child.id;
                        this.menuNumEntries++;
                    }
                }

                if (child.buttonType === ButtonType.BUTTON_TARGET && this.targetMode === 0 && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                    let prefix: string | null = child.targetVerb;
                    if (prefix && prefix.indexOf(' ') !== -1) {
                        prefix = prefix.substring(0, prefix.indexOf(' '));
                    }

                    this.menuOption[this.menuNumEntries] = prefix + ' @gre@' + child.targetBase;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.TGT_BUTTON;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                }

                if (child.buttonType === ButtonType.BUTTON_CLOSE && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                    this.menuOption[this.menuNumEntries] = 'Close';
                    // Java: area==3 sticky → action 55 (unload sticky only); else 639 closeInterfaces
                    // Encode sticky via menuParamA = 1 so doAction can branch without a new enum.
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.CLOSE_BUTTON;
                    this.menuParamA[this.menuNumEntries] = area === 3 ? 1 : 0;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                }

                if (child.buttonType === ButtonType.BUTTON_TOGGLE && child.buttonText && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                    this.menuOption[this.menuNumEntries] = child.buttonText;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.TOGGLE_BUTTON;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                }

                if (child.buttonType === ButtonType.BUTTON_SELECT && child.buttonText && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                    this.menuOption[this.menuNumEntries] = child.buttonText;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.SELECT_BUTTON;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                }

                if (child.buttonType === ButtonType.BUTTON_CONTINUE && !this.resumedPauseButton && child.buttonText && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
                    this.menuOption[this.menuNumEntries] = child.buttonText;
                    this.menuAction[this.menuNumEntries] = MiniMenuAction.PAUSE_BUTTON;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                }

                // Java type == 2 INV (smith columns: iop Make/Make 5/Make 10)
                if (child.type === ComponentType.TYPE_INV) {
                    let slot: number = 0;

                    for (let row: number = 0; row < child.height; row++) {
                        for (let col: number = 0; col < child.width; col++) {
                            let slotX: number = childX + col * (child.marginX + 32);
                            let slotY: number = childY + row * (child.marginY + 32);

                            // Java always has invSlotOffsetX/Y for type 2 after decode
                            if (slot < 20 && child.invBackgroundX && child.invBackgroundY) {
                                slotX += child.invBackgroundX[slot];
                                slotY += child.invBackgroundY[slot];
                            }

                            if (mouseX < slotX || mouseY < slotY || mouseX >= slotX + 32 || mouseY >= slotY + 32) {
                                slot++;
                                continue;
                            }

                            this.hoveredSlot = slot;
                            this.hoveredSlotComId = child.id;

                            if (!child.linkObjType || child.linkObjType[slot] <= 0) {
                                slot++;
                                continue;
                            }

                            const obj: ObjType = ObjType.list(child.linkObjType[slot] - 1);

                            // Java: objSelected==1 && interactable
                            if (this.useMode === 1 && child.objOps) {
                                if (child.id !== this.objSelectedComId || slot !== this.objSelectedSlot) {
                                    this.menuOption[this.menuNumEntries] = 'Use ' + this.objSelectedName + ' with @lre@' + obj.name;
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.USEHELD_ONHELD;
                                    this.menuParamA[this.menuNumEntries] = obj.id;
                                    this.menuParamB[this.menuNumEntries] = slot;
                                    this.menuParamC[this.menuNumEntries] = child.id;
                                    this.menuNumEntries++;
                                }
                            } else if (this.targetMode === 1 && child.objOps) {
                                // Java: spellSelected==1 && interactable && (activeSpellFlags & 0x10)==16
                                if ((this.targetMask & 0x10) === 16) {
                                    this.menuOption[this.menuNumEntries] = this.targetOp + ' @lre@' + obj.name;
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.TGT_HELD;
                                    this.menuParamA[this.menuNumEntries] = obj.id;
                                    this.menuParamB[this.menuNumEntries] = slot;
                                    this.menuParamC[this.menuNumEntries] = child.id;
                                    this.menuNumEntries++;
                                }
                            } else {
                                if (child.objOps) {
                                    for (let op: number = 4; op >= 3; op--) {
                                        if (obj.iop && obj.iop[op]) {
                                            this.menuOption[this.menuNumEntries] = obj.iop[op] + ' @lre@' + obj.name;

                                            if (op === 3) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD4;
                                            } else if (op === 4) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD5;
                                            }

                                            this.menuParamA[this.menuNumEntries] = obj.id;
                                            this.menuParamB[this.menuNumEntries] = slot;
                                            this.menuParamC[this.menuNumEntries] = child.id;
                                            this.menuNumEntries++;
                                        } else if (op === 4) {
                                            this.menuOption[this.menuNumEntries] = 'Drop @lre@' + obj.name;
                                            this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD5;
                                            this.menuParamA[this.menuNumEntries] = obj.id;
                                            this.menuParamB[this.menuNumEntries] = slot;
                                            this.menuParamC[this.menuNumEntries] = child.id;
                                            this.menuNumEntries++;
                                        }
                                    }
                                }

                                if (child.objUse) {
                                    this.menuOption[this.menuNumEntries] = 'Use @lre@' + obj.name;
                                    this.menuAction[this.menuNumEntries] = MiniMenuAction.USEHELD_START;
                                    this.menuParamA[this.menuNumEntries] = obj.id;
                                    this.menuParamB[this.menuNumEntries] = slot;
                                    this.menuParamC[this.menuNumEntries] = child.id;
                                    this.menuNumEntries++;
                                }

                                if (child.objOps && obj.iop) {
                                    for (let op: number = 2; op >= 0; op--) {
                                        if (obj.iop[op]) {
                                            this.menuOption[this.menuNumEntries] = obj.iop[op] + ' @lre@' + obj.name;

                                            if (op === 0) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD1;
                                            } else if (op === 1) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD2;
                                            } else if (op === 2) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD3;
                                            }

                                            this.menuParamA[this.menuNumEntries] = obj.id;
                                            this.menuParamB[this.menuNumEntries] = slot;
                                            this.menuParamC[this.menuNumEntries] = child.id;
                                            this.menuNumEntries++;
                                        }
                                    }
                                }

                                // Component iop → INV_BUTTON1..5 (smith Make / Make 5 / Make 10)
                                if (child.iop) {
                                    for (let op: number = 4; op >= 0; op--) {
                                        if (child.iop[op]) {
                                            this.menuOption[this.menuNumEntries] = child.iop[op] + ' @lre@' + obj.name;

                                            if (op === 0) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON1;
                                            } else if (op === 1) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON2;
                                            } else if (op === 2) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON3;
                                            } else if (op === 3) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON4;
                                            } else if (op === 4) {
                                                this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON5;
                                            }

                                            this.menuParamA[this.menuNumEntries] = obj.id;
                                            this.menuParamB[this.menuNumEntries] = slot;
                                            this.menuParamC[this.menuNumEntries] = child.id;
                                            this.menuNumEntries++;
                                        }
                                    }
                                }

                                this.menuOption[this.menuNumEntries] = 'Examine @lre@' + obj.name;
                                this.menuAction[this.menuNumEntries] = MiniMenuAction.OP_HELD6;
                                this.menuParamA[this.menuNumEntries] = obj.id;
                                this.menuParamB[this.menuNumEntries] = slot;
                                this.menuParamC[this.menuNumEntries] = child.id;
                                this.menuNumEntries++;
                            }

                            slot++;
                        }
                    }
                }
            }
        }
    }

    // todo: order
    private handleSocialMenuOption(component: IfType): boolean {
        let clientCode: number = component.clientCode;

        if ((clientCode >= ClientCode.CC_FRIENDS_START && clientCode <= ClientCode.CC_FRIENDS_UPDATE_END) || !(clientCode < 701 || clientCode > 900)) {
            if (clientCode >= 801) {
                clientCode -= 701;
            } else if (clientCode >= 701) {
                clientCode -= 601;
            } else if (clientCode >= ClientCode.CC_FRIENDS_UPDATE_START) {
                clientCode -= ClientCode.CC_FRIENDS_UPDATE_START;
            } else {
                clientCode--;
            }

            this.menuOption[this.menuNumEntries] = 'Remove @whi@' + this.friendUsername[clientCode];
            this.menuAction[this.menuNumEntries] = MiniMenuAction.FRIENDLIST_DEL;
            this.menuNumEntries++;

            this.menuOption[this.menuNumEntries] = 'Message @whi@' + this.friendUsername[clientCode];
            this.menuAction[this.menuNumEntries] = MiniMenuAction.MESSAGE_PRIVATE;
            this.menuNumEntries++;
            return true;
        } else if (clientCode >= ClientCode.CC_IGNORES_START && clientCode <= ClientCode.CC_IGNORES_END) {
            this.menuOption[this.menuNumEntries] = 'Remove @whi@' + component.text;
            this.menuAction[this.menuNumEntries] = MiniMenuAction.IGNORELIST_DEL;
            this.menuNumEntries++;
            return true;
        }

        return false;
    }

    // todo: order
    private getCombatLevelTag(viewerLevel: number, otherLevel: number): string {
        const diff: number = viewerLevel - otherLevel;
        if (diff < -9) {
            return '@red@';
        } else if (diff < -6) {
            return '@or3@';
        } else if (diff < -3) {
            return '@or2@';
        } else if (diff < 0) {
            return '@or1@';
        } else if (diff > 9) {
            return '@gre@';
        } else if (diff > 6) {
            return '@gr3@';
        } else if (diff > 3) {
            return '@gr2@';
        } else if (diff > 0) {
            return '@gr1@';
        } else {
            return '@yel@';
        }
    }

    /**
     * Java `Client.drawInterface(int y, int x, Component com, int scrollY)`.
     * Arg order in Java is (y, x, com, scroll); TS uses (com, x, y, scroll).
     * Type branches: 0 layer, skip 1, 2 inv, 3 rect, 4 text, 5 graphic, 6 model, 7 inv_text, 8 tooltip.
     */
    private drawInterface(com: IfType | null, x: number, y: number, scrollY: number): void {
        if (!com || com.type !== 0 || !com.children || (com.hide && this.overMainComId !== com.id && this.overSideComId !== com.id && this.overChatComId !== com.id)) {
            return;
        }

        const left: number = Pix2D.clipMinX;
        const top: number = Pix2D.clipMinY;
        const right: number = Pix2D.clipMaxX;
        const bottom: number = Pix2D.clipMaxY;

        Pix2D.setClipping(x, y, x + com.width, y + com.height);

        const children: number = com.children.length;
        for (let i: number = 0; i < children; i++) {
            if (!com.childX || !com.childY) {
                continue;
            }

            let childX: number = com.childX[i] + x;
            let childY: number = com.childY[i] + y - scrollY;

            const child = IfType.get(com.children[i]);
            if (!child) {
                continue;
            }
            childX += child.x;
            childY += child.y;

            if (child.clientCode > 0) {
                this.updateInterfaceContent(child);
            }

            if (child.type === ComponentType.TYPE_LAYER) {
                if (child.scrollPos > child.scrollHeight - child.height) {
                    child.scrollPos = child.scrollHeight - child.height;
                }

                if (child.scrollPos < 0) {
                    child.scrollPos = 0;
                }

                this.drawInterface(child, childX, childY, child.scrollPos);

                if (child.scrollHeight > child.height) {
                    this.drawScrollbar(childX + child.width, childY, child.scrollPos, child.scrollHeight, child.height);
                }
            } else if (child.type === ComponentType.TYPE_INV) {
                // Java 377 drawInterface type==2 — smith columns are width=1 height=5 INV with margin.
                // invSlotObjId stores objId+1 (0=empty). Offsets invSlotOffsetX/Y for first 20 slots.
                // plotSprite: Java (y,x) → TS (x,y); transPlotSprite both (x,y).
                // ObjType.method230(outline, count, id) → TS getSprite(id, count, outline).
                if (!child.linkObjType || !child.linkObjNumber) {
                    // Decode always allocates these for TYPE_INV; skip if corrupt/unpacked mid-stream
                } else {
                    let slot: number = 0;

                    for (let row: number = 0; row < child.height; row++) {
                        for (let col: number = 0; col < child.width; col++) {
                            let slotX: number = childX + col * (child.marginX + 32);
                            let slotY: number = childY + row * (child.marginY + 32);

                            // Java always applies offsets when slot < 20 (arrays always present post-decode)
                            if (slot < 20 && child.invBackgroundX && child.invBackgroundY) {
                                slotX += child.invBackgroundX[slot];
                                slotY += child.invBackgroundY[slot];
                            }

                            if (child.linkObjType[slot] > 0) {
                                let dx: number = 0;
                                let dy: number = 0;
                                const id: number = child.linkObjType[slot] - 1;

                                if (
                                    (slotX > Pix2D.clipMinX - 32 && slotX < Pix2D.clipMaxX && slotY > Pix2D.clipMinY - 32 && slotY < Pix2D.clipMaxY) ||
                                    (this.objDragArea !== 0 && this.objDragSlot === slot)
                                ) {
                                    // Java: objSelected==1 && objSelectedSlot && objSelectedInterface
                                    let outline = 0;
                                    if (this.useMode === 1 && this.objSelectedSlot === slot && this.objSelectedComId === child.id) {
                                        outline = 16777215;
                                    }

                                    const icon: Pix32 | null = ObjType.getSprite(id, child.linkObjNumber[slot], outline);
                                    if (icon) {
                                        if (this.objDragArea !== 0 && this.objDragSlot === slot && this.objDragComId === child.id) {
                                            dx = this.mouseX - this.objGrabX;
                                            dy = this.mouseY - this.objGrabY;

                                            if (dx < 5 && dx > -5) {
                                                dx = 0;
                                            }

                                            if (dy < 5 && dy > -5) {
                                                dy = 0;
                                            }

                                            if (this.objDragCycles < 5) {
                                                dx = 0;
                                                dy = 0;
                                            }

                                            // Java transPlotSprite(x, y, alpha) — same order as TS
                                            icon.transPlotSprite(slotX + dx, slotY + dy, 128);

                                            if (slotY + dy < Pix2D.clipMinY && com.scrollPos > 0) {
                                                let autoscroll = ((Pix2D.clipMinY - slotY - dy) * this.worldUpdateNum) / 3;
                                                if (autoscroll > this.worldUpdateNum * 10) {
                                                    autoscroll = this.worldUpdateNum * 10;
                                                }

                                                if (autoscroll > com.scrollPos) {
                                                    autoscroll = com.scrollPos;
                                                }

                                                com.scrollPos -= autoscroll;
                                                this.objGrabY += autoscroll;
                                            }

                                            if (slotY + dy + 32 > Pix2D.clipMaxY && com.scrollPos < com.scrollHeight - com.height) {
                                                let autoscroll = ((slotY + dy + 32 - Pix2D.clipMaxY) * this.worldUpdateNum) / 3;
                                                if (autoscroll > this.worldUpdateNum * 10) {
                                                    autoscroll = this.worldUpdateNum * 10;
                                                }

                                                if (autoscroll > com.scrollHeight - com.height - com.scrollPos) {
                                                    autoscroll = com.scrollHeight - com.height - com.scrollPos;
                                                }

                                                com.scrollPos += autoscroll;
                                                this.objGrabY -= autoscroll;
                                            }
                                        } else if (this.selectedArea !== 0 && this.selectedItem === slot && this.selectedComId === child.id) {
                                            icon.transPlotSprite(slotX, slotY, 128);
                                        } else {
                                            // Java plotSprite(y, x) → TS plotSprite(x, y)
                                            icon.plotSprite(slotX, slotY);
                                        }

                                        // Stack count: owi==33 (stackable) or count != 1
                                        if (icon.owi === 33 || child.linkObjNumber[slot] !== 1) {
                                            const count: number = child.linkObjNumber[slot];
                                            // Java formatObjCount + fontPlain11.drawString(x, colour, y, s)
                                            this.p11?.drawString(this.formatObjCount(count), slotX + dx + 1, slotY + 10 + dy, Colour.BLACK);
                                            this.p11?.drawString(this.formatObjCount(count), slotX + dx, slotY + 9 + dy, 0xffff00);
                                        }
                                    }
                                }
                            } else if (child.invBackground && slot < 20) {
                                // Java invSlotGraphic empty-slot decoration
                                const image: Pix32 | null = child.invBackground[slot];
                                image?.plotSprite(slotX, slotY);
                            }

                            slot++;
                        }
                    }
                }
            } else if (child.type === ComponentType.TYPE_RECT) {
                let hovered: boolean = false;
                if (this.overChatComId === child.id || this.overSideComId === child.id || this.overMainComId === child.id) {
                    hovered = true;
                }

                let colour: number = 0;
                if (this.executeInterfaceScript(child)) {
                    colour = child.colour2;

                    if (hovered && child.colour2Over !== 0) {
                        colour = child.colour2Over;
                    }
                } else {
                    colour = child.colour;

                    if (hovered && child.colourOver !== 0) {
                        colour = child.colourOver;
                    }
                }

                if (child.trans === 0) {
                    if (child.fill) {
                        Pix2D.fillRect(childX, childY, child.width, child.height, colour);
                    } else {
                        Pix2D.drawRect(childX, childY, child.width, child.height, colour);
                    }
                } else if (child.fill) {
                    Pix2D.fillRectTrans(childX, childY, child.width, child.height, colour, 256 - (child.trans & 0xff));
                } else {
                    Pix2D.drawRect(childX, childY, child.width, child.height, colour);
                    Pix2D.drawRectTrans(childX, childY, child.width, child.height, colour, 256 - (child.trans & 0xff));
                }
            } else if (child.type === ComponentType.TYPE_TEXT) {
                const font: PixFont | null = child.font;
                let text: string | null = child.text;

                let hovered: boolean = false;
                if (this.overChatComId === child.id || this.overSideComId === child.id || this.overMainComId === child.id) {
                    hovered = true;
                }

                let colour: number = 0;
                if (this.executeInterfaceScript(child)) {
                    colour = child.colour2;

                    if (hovered && child.colour2Over !== 0) {
                        colour = child.colour2Over;
                    }

                    if (child.text2 && child.text2.length > 0) {
                        text = child.text2;
                    }
                } else {
                    colour = child.colour;

                    if (hovered && child.colourOver !== 0) {
                        colour = child.colourOver;
                    }
                }

                if (child.buttonType === ButtonType.BUTTON_CONTINUE && this.resumedPauseButton) {
                    text = 'Please wait...';
                    colour = child.colour;
                }

                if (Pix2D.width == 479) {
                    if (colour == 0xffff00) {
                        colour = 0x0000ff;
                    }

                    if (colour == 0x00c000) {
                        colour = 0xffffff;
                    }
                }

                if (!font || !text) {
                    continue;
                }

                for (let lineY: number = childY + font.height; text.length > 0; lineY += font.height) {
                    if (text.indexOf('%') !== -1) {
                        do {
                            const index: number = text.indexOf('%1');
                            if (index === -1) {
                                break;
                            }

                            text = text.substring(0, index) + this.getIntString(this.executeClientScript(child, 0)) + text.substring(index + 2);
                        } while (true);

                        do {
                            const index: number = text.indexOf('%2');
                            if (index === -1) {
                                break;
                            }

                            text = text.substring(0, index) + this.getIntString(this.executeClientScript(child, 1)) + text.substring(index + 2);
                        } while (true);

                        do {
                            const index: number = text.indexOf('%3');
                            if (index === -1) {
                                break;
                            }

                            text = text.substring(0, index) + this.getIntString(this.executeClientScript(child, 2)) + text.substring(index + 2);
                        } while (true);

                        do {
                            const index: number = text.indexOf('%4');
                            if (index === -1) {
                                break;
                            }

                            text = text.substring(0, index) + this.getIntString(this.executeClientScript(child, 3)) + text.substring(index + 2);
                        } while (true);

                        do {
                            const index: number = text.indexOf('%5');
                            if (index === -1) {
                                break;
                            }

                            text = text.substring(0, index) + this.getIntString(this.executeClientScript(child, 4)) + text.substring(index + 2);
                        } while (true);
                    }

                    const newline: number = text.indexOf('\\n');
                    let split: string;
                    if (newline !== -1) {
                        split = text.substring(0, newline);
                        text = text.substring(newline + 2);
                    } else {
                        split = text;
                        text = '';
                    }

                    if (child.centre) {
                        font.centreStringTag(split, childX + ((child.width / 2) | 0), lineY, colour, child.shadow);
                    } else {
                        font.drawStringTag(split, childX, lineY, colour, child.shadow);
                    }
                }
            } else if (child.type === ComponentType.TYPE_GRAPHIC) {
                let image: Pix32 | null;
                if (this.executeInterfaceScript(child)) {
                    image = child.graphic2;
                } else {
                    image = child.graphic;
                }

                image?.plotSprite(childX, childY);
            } else if (child.type === ComponentType.TYPE_MODEL) {
                const tmpX: number = Pix3D.originX;
                const tmpY: number = Pix3D.originY;

                Pix3D.originX = childX + ((child.width / 2) | 0);
                Pix3D.originY = childY + ((child.height / 2) | 0);

                const eyeY: number = (Pix3D.sinTable[child.modelXAn] * child.modelZoom) >> 16;
                const eyeZ: number = (Pix3D.cosTable[child.modelXAn] * child.modelZoom) >> 16;

                const active: boolean = this.executeInterfaceScript(child);

                let seqId: number;
                if (active) {
                    seqId = child.modelAnim2;
                } else {
                    seqId = child.modelAnim;
                }

                let model: Model | null = null;
                if (seqId === -1) {
                    model = child.getTempModel(-1, -1, active, this.localPlayer);
                } else {
                    const seq: SeqType = SeqType.list[seqId];
                    if (seq.frames && seq.iframes) {
                        model = child.getTempModel(seq.frames[child.animFrame], seq.iframes[child.animFrame], active, this.localPlayer);
                    }
                }

                if (model) {
                    model.objRender(0, child.modelYAn, 0, child.modelXAn, 0, eyeY, eyeZ);
                }

                Pix3D.originX = tmpX;
                Pix3D.originY = tmpY;
            } else if (child.type === ComponentType.TYPE_INV_TEXT) {
                const font: PixFont | null = child.font;
                if (!font || !child.linkObjType || !child.linkObjNumber) {
                    continue;
                }

                let slot: number = 0;
                for (let row: number = 0; row < child.height; row++) {
                    for (let col: number = 0; col < child.width; col++) {
                        if (child.linkObjType[slot] > 0) {
                            const obj: ObjType = ObjType.list(child.linkObjType[slot] - 1);
                            let text: string | null = obj.name;
                            if (obj.stackable || child.linkObjNumber[slot] !== 1) {
                                text = text + ' x' + this.formatObjCountTagged(child.linkObjNumber[slot]);
                            }

                            if (!text) {
                                continue;
                            }

                            const textX: number = childX + col * (child.marginX + 115);
                            const textY: number = childY + row * (child.marginY + 12);

                            if (child.centre) {
                                font.centreStringTag(text, textX + ((child.width / 2) | 0), textY, child.colour, child.shadow);
                            } else {
                                font.drawStringTag(text, textX, textY, child.colour, child.shadow);
                            }
                        }

                        slot++;
                    }
                }
            } else if (
                // Java type == 8 tooltip box (only after hover delay field189 == 100)
                child.type === ComponentType.TYPE_TEXT_STATIC &&
                (this.overTooltipChat === child.id || this.overTooltipSide === child.id || this.overTooltipMain === child.id) &&
                this.tooltipTimer === 100
            ) {
                const font: PixFont | null = this.p12;
                if (!font || !child.text) {
                    continue;
                }

                let tip: string = child.text;
                let boxW: number = 0;
                let boxH: number = 0;

                // measure multi-line tooltip
                let measure: string = tip;
                while (measure.length > 0) {
                    const nl: number = measure.indexOf('\\n');
                    let line: string;
                    if (nl === -1) {
                        line = measure;
                        measure = '';
                    } else {
                        line = measure.substring(0, nl);
                        measure = measure.substring(nl + 2);
                    }
                    const w: number = font.stringWid(line);
                    if (w > boxW) {
                        boxW = w;
                    }
                    boxH += font.height + 1;
                }
                boxW += 6;
                boxH += 7;

                let boxX: number = childX + child.width - 5 - boxW;
                let boxY: number = childY + child.height + 5;
                if (boxX < childX + 5) {
                    boxX = childX + 5;
                }
                if (boxX + boxW > x + com.width) {
                    boxX = x + com.width - boxW;
                }
                if (boxY + boxH > y + com.height) {
                    boxY = y + com.height - boxH;
                }

                // Java: fillRect yellow-ish 16777120, drawRect black
                Pix2D.fillRect(boxX, boxY, boxW, boxH, 0xffffa0);
                Pix2D.drawRect(boxX, boxY, boxW, boxH, Colour.BLACK);

                let lineY: number = boxY + font.height + 2;
                let draw: string = tip;
                while (draw.length > 0) {
                    const nl: number = draw.indexOf('\\n');
                    let line: string;
                    if (nl === -1) {
                        line = draw;
                        draw = '';
                    } else {
                        line = draw.substring(0, nl);
                        draw = draw.substring(nl + 2);
                    }
                    font.drawStringTag(line, boxX + 3, lineY, Colour.BLACK, false);
                    lineY += font.height + 1;
                }
            }
        }

        Pix2D.setClipping(left, top, right, bottom);
    }

    // todo: order
    private formatObjCount(amount: number): string {
        if (amount < 100000) {
            return String(amount);
        } else if (amount < 10000000) {
            return ((amount / 1000) | 0) + 'K';
        } else {
            return ((amount / 1000000) | 0) + 'M';
        }
    }

    private formatObjCountTagged(amount: number): string {
        let s: string = String(amount);
        for (let i: number = s.length - 3; i > 0; i -= 3) {
            s = s.substring(0, i) + ',' + s.substring(i);
        }
        if (s.length > 8) {
            s = '@gre@' + s.substring(0, s.length - 8) + ' million @whi@(' + s + ')';
        } else if (s.length > 4) {
            s = '@cya@' + s.substring(0, s.length - 4) + 'K @whi@(' + s + ')';
        }
        return ' ' + s;
    }

    private handleScrollInput(x: number, y: number, scrollableHeight: number, height: number, redraw: boolean, left: number, top: number, com: IfType): void {
        if (this.scrollGrabbed) {
            this.scrollInputPadding = 32;
        } else {
            this.scrollInputPadding = 0;
        }

        this.scrollGrabbed = false;

        if (x >= left && x < left + 16 && y >= top && y < top + 16) {
            com.scrollPos -= this.scrollCycle * 4;

            if (redraw) {
                this.redrawSide = true;
            }
        } else if (x >= left && x < left + 16 && y >= top + height - 16 && y < top + height) {
            com.scrollPos += this.scrollCycle * 4;

            if (redraw) {
                this.redrawSide = true;
            }
        } else if (x >= left - this.scrollInputPadding && x < left + this.scrollInputPadding + 16 && y >= top + 16 && y < top + height - 16 && this.scrollCycle > 0) {
            let gripSize: number = (((height - 32) * height) / scrollableHeight) | 0;
            if (gripSize < 8) {
                gripSize = 8;
            }

            const gripY: number = y - top - ((gripSize / 2) | 0) - 16;
            const maxY: number = height - gripSize - 32;

            com.scrollPos = (((scrollableHeight - height) * gripY) / maxY) | 0;

            if (redraw) {
                this.redrawSide = true;
            }

            this.scrollGrabbed = true;
        }
    }

    private drawScrollbar(x: number, y: number, scrollY: number, scrollHeight: number, height: number): void {
        this.scrollbar1?.plotSprite(x, y);
        this.scrollbar2?.plotSprite(x, y + height - 16);
        Pix2D.fillRect(x, y + 16, 16, height - 32, SCROLLBAR_TRACK);

        let gripSize: number = (((height - 32) * height) / scrollHeight) | 0;
        if (gripSize < 8) {
            gripSize = 8;
        }

        const gripY: number = (((height - gripSize - 32) * scrollY) / (scrollHeight - height)) | 0;
        Pix2D.fillRect(x, y + gripY + 16, 16, gripSize, SCROLLBAR_GRIP_FOREGROUND);

        Pix2D.vline(x, y + gripY + 16, gripSize, SCROLLBAR_GRIP_HIGHLIGHT);
        Pix2D.vline(x + 1, y + gripY + 16, gripSize, SCROLLBAR_GRIP_HIGHLIGHT);

        Pix2D.hline(x, y + gripY + 16, 16, SCROLLBAR_GRIP_HIGHLIGHT);
        Pix2D.hline(x, y + gripY + 17, 16, SCROLLBAR_GRIP_HIGHLIGHT);

        Pix2D.vline(x + 15, y + gripY + 16, gripSize, SCROLLBAR_GRIP_LOWLIGHT);
        Pix2D.vline(x + 14, y + gripY + 17, gripSize - 1, SCROLLBAR_GRIP_LOWLIGHT);

        Pix2D.hline(x, y + gripY + gripSize + 15, 16, SCROLLBAR_GRIP_LOWLIGHT);
        Pix2D.hline(x + 1, y + gripY + gripSize + 14, 15, SCROLLBAR_GRIP_LOWLIGHT);
    }

    private getIntString(value: number): string {
        return value < 999999999 ? String(value) : '*';
    }

    private executeInterfaceScript(com: IfType): boolean {
        if (!com.scriptComparator) {
            return false;
        }

        for (let i: number = 0; i < com.scriptComparator.length; i++) {
            if (!com.scriptOperand) {
                return false;
            }

            const value: number = this.executeClientScript(com, i);
            const operand: number = com.scriptOperand[i];

            if (com.scriptComparator[i] === 2) {
                if (value >= operand) {
                    return false;
                }
            } else if (com.scriptComparator[i] === 3) {
                if (value <= operand) {
                    return false;
                }
            } else if (com.scriptComparator[i] === 4) {
                if (value === operand) {
                    return false;
                }
            } else if (value !== operand) {
                return false;
            }
        }

        return true;
    }

    private executeClientScript(com: IfType, scriptId: number): number {
        if (!com.scripts || scriptId >= com.scripts.length) {
            return -2;
        }

        try {
            const script: Uint16Array | null = com.scripts[scriptId];
            if (!script) {
                return -1;
            }

            let acc = 0;
            let pc: number = 0;
            let arithmetic = 0;

            while (true) {
                let register: number = 0;
                let nextArithmetic: number = 0;

                const opcode: number = script[pc++];
                if (opcode === 0) {
                    return acc;
                }

                if (opcode === 1) {
                    // stat_level {skill}
                    register = this.statEffectiveLevel[script[pc++]];
                } else if (opcode === 2) {
                    // stat_base_level {skill}
                    register = this.statBaseLevel[script[pc++]];
                } else if (opcode === 3) {
                    // stat_xp {skill}
                    register = this.statXP[script[pc++]];
                } else if (opcode === 4) {
                    // inv_count {interface id} {obj id}
                    // Java executeClientScript op4: raw obj id for ObjType.get; compare invSlotObjId == obj+1
                    const invCom = IfType.get(script[pc++]);
                    const objId: number = script[pc++];

                    if (
                        invCom &&
                        invCom.linkObjType &&
                        invCom.linkObjNumber &&
                        objId >= 0 &&
                        objId < ObjType.numDefinitions &&
                        (!ObjType.list(objId).members || Client.memServer)
                    ) {
                        for (let i: number = 0; i < invCom.linkObjType.length; i++) {
                            if (invCom.linkObjType[i] === objId + 1) {
                                register += invCom.linkObjNumber[i];
                            }
                        }
                    }
                } else if (opcode === 5) {
                    // pushvar {id}
                    register = this.var[script[pc++]];
                } else if (opcode === 6) {
                    // stat_xp_remaining {skill}
                    register = Client.levelExperience[this.statBaseLevel[script[pc++]] - 1];
                } else if (opcode === 7) {
                    register = ((this.var[script[pc++]] * 100) / 46875) | 0;
                } else if (opcode === 8) {
                    // combat level
                    register = this.localPlayer?.combatLevel || 0;
                } else if (opcode === 9) {
                    // total level
                    for (let i: number = 0; i < Skill.count; i++) {
                        if (Skill.used[i]) {
                            register += this.statBaseLevel[i];
                        }
                    }
                } else if (opcode === 10) {
                    // inv_contains {interface id} {obj id}
                    // Java op10: uses (obj+1) for both ObjType.get bounds and invSlotObjId compare (as-decompiled)
                    const invCom = IfType.get(script[pc++]);
                    const objPlus1: number = script[pc++] + 1;

                    if (
                        invCom &&
                        invCom.linkObjType &&
                        objPlus1 >= 0 &&
                        objPlus1 < ObjType.numDefinitions &&
                        (!ObjType.list(objPlus1).members || Client.memServer)
                    ) {
                        for (let i: number = 0; i < invCom.linkObjType.length; i++) {
                            if (invCom.linkObjType[i] === objPlus1) {
                                register = 999999999;
                                break;
                            }
                        }
                    }
                } else if (opcode === 11) {
                    // runenergy
                    register = this.runenergy;
                } else if (opcode === 12) {
                    // runweight
                    register = this.runweight;
                } else if (opcode === 13) {
                    // testbit {varp} {bit: 0..31}
                    const varp: number = this.var[script[pc++]];
                    const lsb: number = script[pc++];

                    register = (varp & (0x1 << lsb)) === 0 ? 0 : 1;
                } else if (opcode === 14) {
                    // push_varbit {varbit}
                    const varbit: VarBitType = VarBitType.list[script[pc++]];
                    const { basevar, startbit, endbit } = varbit;

                    const mask = Client.readbit[endbit - startbit];
                    register = (this.var[basevar] >> startbit) & mask;
                } else if (opcode === 15) {
                    // subtract
                    nextArithmetic = 1;
                } else if (opcode === 16) {
                    // divide
                    nextArithmetic = 2;
                } else if (opcode === 17) {
                    // multiply
                    nextArithmetic = 3;
                } else if (opcode === 18) {
                    // coordx
                    if (this.localPlayer) {
                        register = (this.localPlayer.x >> 7) + this.mapBuildBaseX;
                    }
                } else if (opcode === 19) {
                    // coordz
                    if (this.localPlayer) {
                        register = (this.localPlayer.z >> 7) + this.mapBuildBaseZ;
                    }
                } else if (opcode === 20) {
                    // push_constant
                    register = script[pc++];
                }

                if (nextArithmetic === 0) {
                    if (arithmetic === 0) {
                        acc += register;
                    } else if (arithmetic === 1) {
                        acc -= register;
                    } else if (arithmetic === 2 && register !== 0) {
                        acc = (acc / register) | 0;
                    } else if (arithmetic === 3) {
                        acc = (acc * register) | 0;
                    }

                    arithmetic = 0;
                } else {
                    arithmetic = nextArithmetic;
                }
            }
        } catch (_e) {
            return -1;
        }
    }

    /**
     * Port of Client-Java `Client.unloadCom` → `Component.unloadCom(int)`.
     * Nulls every component with layerId == id and type != INV (2).
     * IF_SETTAB uses this on the previous tab interface — not ifAnimReset.
     * Rehydrate via `IfType.get` on next draw/input after tab swap.
     */
    private unloadCom(id: number): void {
        IfType.unloadCom(id);
    }

    /**
     * Java `resetInterfaceAnimation` — recurse when child.type == 1 (matches deob).
     * Nested layers are type 0; type-1 branch is dead for current archive layout but kept for Java parity.
     * Also recurse type 0 so nested layers actually reset (safe extension for inv/tabs).
     */
    private resetInterfaceAnimation(id: number): void {
        const parent = IfType.get(id);
        if (!parent || !parent.children) {
            return;
        }

        for (let i: number = 0; i < parent.children.length && parent.children[i] !== -1; i++) {
            const child = IfType.get(parent.children[i]);
            if (!child) {
                continue;
            }

            // Java recurses type==1; type 0 LAYER also has children — must recurse both
            if (child.type === ComponentType.TYPE_LAYER || child.type === ComponentType.TYPE_UNUSED) {
                this.resetInterfaceAnimation(child.id);
            }

            child.animFrame = 0;
            child.animCycle = 0;
        }
    }

    /**
     * Java `updateInterfaceAnimation(delta, id)`.
     * Recurses type 0 LAYER (not type 1 — that was a TS bug).
     * Type 6 model anim + field700 modelRotate spin.
     */
    private updateInterfaceAnimation(id: number, delta: number): boolean {
        const parent = IfType.get(id);
        if (!parent || !parent.children) {
            return false;
        }

        let updated: boolean = false;

        for (let i: number = 0; i < parent.children.length && parent.children[i] !== -1; i++) {
            const child = IfType.get(parent.children[i]);
            if (!child) {
                continue;
            }

            // Java: if (var7.type == 0) recurse
            if (child.type === ComponentType.TYPE_LAYER) {
                updated ||= this.updateInterfaceAnimation(child.id, delta);
            }

            if (child.type === ComponentType.TYPE_MODEL && (child.modelAnim !== -1 || child.modelAnim2 !== -1)) {
                const active: boolean = this.executeInterfaceScript(child);

                let seqId: number;
                if (active) {
                    seqId = child.modelAnim2;
                } else {
                    seqId = child.modelAnim;
                }

                if (seqId !== -1) {
                    const type: SeqType = SeqType.list[seqId];
                    child.animCycle += delta;

                    while (child.animCycle > type.getDelay(child.animFrame)) {
                        child.animCycle -= type.getDelay(child.animFrame) + 1;
                        child.animFrame++;

                        if (child.animFrame >= type.numFrames) {
                            child.animFrame -= type.loops;

                            if (child.animFrame < 0 || child.animFrame >= type.numFrames) {
                                child.animFrame = 0;
                            }
                        }

                        updated = true;
                    }
                }
            }

            // Java field700 model spin rates
            if (child.type === ComponentType.TYPE_MODEL && child.modelRotate !== 0) {
                const xanDelta: number = child.modelRotate >> 16;
                const yanDelta: number = (child.modelRotate << 16) >> 16;
                child.modelXAn = (child.modelXAn + delta * xanDelta) & 0x7ff;
                child.modelYAn = (child.modelYAn + delta * yanDelta) & 0x7ff;
                updated = true;
            }
        }

        return updated;
    }

    private updateVarp(id: number): void {
        const clientcode: number = VarpType.list[id].clientcode;
        if (clientcode === 0) {
            return;
        }

        const value: number = this.var[id];
        if (clientcode === 1) {
            if (value === 1) {
                Pix3D.initColourTable(0.9);
            } else if (value === 2) {
                Pix3D.initColourTable(0.8);
            } else if (value === 3) {
                Pix3D.initColourTable(0.7);
            } else if (value === 4) {
                Pix3D.initColourTable(0.6);
            }

            ObjType.spriteCache?.clear();
            this.redrawFrame = true;
        } else if (clientcode === 3) {
            // Java Client clientcode 3: midivol 128/96/64/32 / mute (Decision 012)
            const lastMidiActive: boolean = this.midiActive;

            if (value === 0) {
                this.setMidiVolumeJava(this.midiActive, 128);
                this.midiActive = true;
            } else if (value === 1) {
                this.setMidiVolumeJava(this.midiActive, 96);
                this.midiActive = true;
            } else if (value === 2) {
                this.setMidiVolumeJava(this.midiActive, 64);
                this.midiActive = true;
            } else if (value === 3) {
                this.setMidiVolumeJava(this.midiActive, 32);
                this.midiActive = true;
            } else if (value === 4) {
                this.midiActive = false;
            }

            // Java only restarts music when midiActive flips (and !lowMem)
            if (this.midiActive !== lastMidiActive && !Client.lowMem) {
                if (this.midiActive) {
                    this.midiSong = this.nextMidiSong;
                    this.midiFading = true;
                    this.onDemand?.request(2, this.midiSong);
                } else {
                    this.stopMidiJava();
                }
                this.nextMusicDelay = 0;
            }
        } else if (clientcode === 4) {
            if (value === 0) {
                this.waveVolume = 0; // +0 dB
                this.waveEnabled = true;
            } else if (value === 1) {
                this.waveVolume = -4; // -4 dB
                this.waveEnabled = true;
            } else if (value === 2) {
                this.waveVolume = -8; // -8 dB
                this.waveEnabled = true;
            } else if (value === 3) {
                this.waveVolume = -12; // -12 dB
                this.waveEnabled = true;
            } else if (value === 4) {
                this.waveEnabled = false;
            }

            if (this.waveEnabled) {
                setWaveVolume(this.waveVolume);
            }
        } else if (clientcode === 5) {
            this.oneMouseButton = value;
        } else if (clientcode === 6) {
            this.chatEffects = value;
        } else if (clientcode === 8) {
            this.splitPrivateChat = value;
            this.redrawChat = true;
        } else if (clientcode === 9) {
            this.bankArrangeMode = value;
        }
    }

    private updateInterfaceContent(com: IfType): void {
        let clientCode: number = com.clientCode;

        if ((clientCode >= ClientCode.CC_FRIENDS_START && clientCode <= ClientCode.CC_FRIENDS_END) || (clientCode >= ClientCode.CC_FRIENDS2_START && clientCode <= ClientCode.CC_FRIENDS2_END)) {
            if (clientCode === ClientCode.CC_FRIENDS_START && this.friendServerStatus === 0) {
                com.text = 'Loading friend list';
                com.buttonType = 0;
            } else if (clientCode === ClientCode.CC_FRIENDS_START && this.friendServerStatus === 1) {
                com.text = 'Connecting to friendserver';
                com.buttonType = 0;
            } else if (clientCode === 2 && this.friendServerStatus !== 2) {
                com.text = 'Please wait...';
                com.buttonType = 0;
            } else {
                let count = this.friendCount;
                if (this.friendServerStatus != 2) {
                    count = 0;
                }

                if (clientCode > 700) {
                    clientCode -= 601;
                } else {
                    clientCode -= 1;
                }

                if (clientCode >= count) {
                    com.text = '';
                    com.buttonType = 0;
                } else {
                    com.text = this.friendUsername[clientCode];
                    com.buttonType = 1;
                }
            }
        } else if ((clientCode >= ClientCode.CC_FRIENDS_UPDATE_START && clientCode <= ClientCode.CC_FRIENDS_UPDATE_END) || (clientCode >= ClientCode.CC_FRIENDS2_UPDATE_START && clientCode <= ClientCode.CC_FRIENDS2_UPDATE_END)) {
            let count = this.friendCount;
            if (this.friendServerStatus != 2) {
                count = 0;
            }

            if (clientCode > 800) {
                clientCode -= 701;
            } else {
                clientCode -= 101;
            }

            if (clientCode >= count) {
                com.text = '';
                com.buttonType = 0;
            } else {
                if (this.friendNodeId[clientCode] === 0) {
                    com.text = '@red@Offline';
                } else if (this.friendNodeId[clientCode] === Client.nodeId) {
                    com.text = '@gre@World-' + (this.friendNodeId[clientCode] - 9);
                } else {
                    com.text = '@yel@World-' + (this.friendNodeId[clientCode] - 9);
                }

                com.buttonType = 1;
            }
        } else if (clientCode === ClientCode.CC_FRIENDS_SIZE) {
            let count = this.friendCount;
            if (this.friendServerStatus != 2) {
                count = 0;
            }

            com.scrollHeight = count * 15 + 20;

            if (com.scrollHeight <= com.height) {
                com.scrollHeight = com.height + 1;
            }
        } else if (clientCode >= ClientCode.CC_IGNORES_START && clientCode <= ClientCode.CC_IGNORES_END) {
            clientCode -= ClientCode.CC_IGNORES_START;

            if (clientCode >= this.ignoreCount) {
                com.text = '';
                com.buttonType = 0;
            } else {
                com.text = JString.toScreenName(JString.toRawUsername(this.ignoreUserhash[clientCode]));
                com.buttonType = 1;
            }
        } else if (clientCode === ClientCode.CC_IGNORES_SIZE) {
            com.scrollHeight = this.ignoreCount * 15 + 20;

            if (com.scrollHeight <= com.height) {
                com.scrollHeight = com.height + 1;
            }
        } else if (clientCode === ClientCode.CC_DESIGN_PREVIEW) {
            com.modelXAn = 150;
            com.modelYAn = ((Math.sin(Client.loopCycle / 40.0) * 256.0) | 0) & 0x7ff;

            if (this.idkDesignRedraw) {
                for (let i = 0; i < 7; i++) {
                    const kit = this.idkDesignPart[i];
                    if (kit >= 0 && !IdkType.list[kit].checkModel()) {
                        return;
                    }
                }

                this.idkDesignRedraw = false;

                const models: (Model | null)[] = new TypedArray1d(7, null);
                let modelCount: number = 0;
                for (let part: number = 0; part < 7; part++) {
                    const kit: number = this.idkDesignPart[part];
                    if (kit >= 0) {
                        models[modelCount++] = IdkType.list[kit].getModelNoCheck();
                    }
                }

                const model: Model = Model.combineForAnim(models, modelCount);
                for (let part: number = 0; part < 5; part++) {
                    if (this.idkDesignColour[part] !== 0) {
                        model.recolour(ClientPlayer.recol1d[part][0], ClientPlayer.recol1d[part][this.idkDesignColour[part]]);

                        if (part === 1) {
                            model.recolour(ClientPlayer.recol2d[0], ClientPlayer.recol2d[this.idkDesignColour[part]]);
                        }
                    }
                }

                model.prepareAnim();
                model.calculateNormals(64, 850, -30, -50, -30, true);

                if (this.localPlayer) {
                    const frames: Int16Array | null = SeqType.list[this.localPlayer.readyanim].frames;
                    if (frames) {
                        model.animate(frames[0]);
                    }
                }

                com.model1Type = 5;
                com.model1Id = 0;
                IfType.cacheModel(model, 5, 0);
            }
        } else if (clientCode === ClientCode.CC_SWITCH_TO_MALE) {
            if (!this.idkDesignButton1) {
                this.idkDesignButton1 = com.graphic;
                this.idkDesignButton2 = com.graphic2;
            }

            if (this.idkDesignGender) {
                com.graphic = this.idkDesignButton2;
            } else {
                com.graphic = this.idkDesignButton1;
            }
        } else if (clientCode === ClientCode.CC_SWITCH_TO_FEMALE) {
            if (!this.idkDesignButton1) {
                this.idkDesignButton1 = com.graphic;
                this.idkDesignButton2 = com.graphic2;
            }

            if (this.idkDesignGender) {
                com.graphic = this.idkDesignButton1;
            } else {
                com.graphic = this.idkDesignButton2;
            }
        } else if (clientCode === ClientCode.CC_REPORT_INPUT) {
            com.text = this.reportAbuseInput;

            if (Client.loopCycle % 20 < 10) {
                com.text = com.text + '|';
            } else {
                com.text = com.text + ' ';
            }
        } else if (clientCode === ClientCode.CC_MOD_MUTE) {
            if (this.staffmodlevel < 1) {
                com.text = '';
            } else if (this.reportAbuseMuteOption) {
                com.colour = Colour.RED;
                com.text = 'Moderator option: Mute player for 48 hours: <ON>';
            } else {
                com.colour = Colour.WHITE;
                com.text = 'Moderator option: Mute player for 48 hours: <OFF>';
            }
        } else if (clientCode === ClientCode.CC_LAST_LOGIN_INFO) {
            // Java clientCode 660
            const daysAgo: number = this.currentDay - this.previousLoginDay;
            let when: string;
            if (daysAgo <= 0) {
                when = 'earlier today';
            } else if (daysAgo === 1) {
                when = 'yesterday';
            } else {
                when = daysAgo + ' days ago';
            }
            const host = this.dnsReq ?? JString.formatIPv4(this.lastAddress >>> 0);
            com.text = 'You last logged in @red@' + when + '@bla@ from: @red@' + host;
        } else if (clientCode === ClientCode.CC_RECOVERY_QUESTIONS) {
            // Java clientCode 661
            if (this.recoveriesLastChangedDay === 0) {
                com.text =
                    '\\nYou have not yet set any recovery questions.\\nIt is @lre@strongly@yel@ recommended that you do so.\\n\\nIf you don\'t you will be @lre@unable to recover your\\n@lre@password@yel@ if you forget it, or it is stolen.';
            } else if (this.recoveriesLastChangedDay <= this.currentDay) {
                com.text = '\\n\\nRecovery Questions Last Set:\\n@gre@' + this.getDateString(this.recoveriesLastChangedDay);
            } else {
                const pending: number = this.currentDay + 14 - this.recoveriesLastChangedDay;
                let when: string;
                if (pending <= 0) {
                    when = 'Earlier today';
                } else if (pending === 1) {
                    when = 'Yesterday';
                } else {
                    when = pending + ' days ago';
                }
                com.text =
                    when +
                    ' you requested@lre@ new recovery\\n@lre@questions.@yel@ The requested change will occur\\non: @lre@' +
                    this.getDateString(this.recoveriesLastChangedDay) +
                    '\\n\\nIf you do not remember making this request\\ncancel it immediately, and change your password.';
            }
        } else if (clientCode === ClientCode.CC_UNREAD_MESSAGES) {
            // Java clientCode 662
            let msg: string;
            if (this.unreadMessages === 0) {
                msg = '@yel@0 unread messages';
            } else if (this.unreadMessages === 1) {
                msg = '@gre@1 unread message';
            } else {
                msg = '@gre@' + this.unreadMessages + ' unread messages';
            }
            com.text = 'You have ' + msg + '\\nin your message centre.';
        } else if (clientCode === ClientCode.CC_PASSWORD_CHANGE) {
            // Java clientCode 663
            if (this.daysSincePasswordChanged > 0 && this.daysSincePasswordChanged <= this.currentDay + 10) {
                com.text = 'Last password change:\\n@gre@' + this.getDateString(this.daysSincePasswordChanged);
            } else {
                com.text = 'Last password change:\\n@gre@Never changed';
            }
        } else if (clientCode === ClientCode.CC_MEMBERS_CREDIT) {
            // Java clientCode 665 — no membersWorld flag in TS; treat as free world
            if (this.daysOfMembersRemaining > 2) {
                com.text =
                    'This is a non-members\\nworld. To enjoy your\\nmembers benefits we\\nrecommend you play on a\\nmembers world instead.';
            } else if (this.daysOfMembersRemaining > 0) {
                com.text =
                    'You have @gre@' +
                    this.daysOfMembersRemaining +
                    '@yel@ days of\\nmember credit remaining.\\n\\n@lre@Credit low! Renew now\\n@lre@to avoid losing members.';
            } else {
                com.text = 'You are not a member.\\n\\nChoose to subscribe and\\nyou\'ll get loads of extra\\nbenefits and features.';
            }
        } else if (clientCode === ClientCode.CC_MEMBERS_HELP) {
            // Java clientCode 667
            if (this.daysOfMembersRemaining > 2) {
                com.text =
                    'To switch to a members-only world:\\n1) Logout and return to the world selection page.\\n2) Choose one of the members world with a gold star next to it\'s name.\\n\\nIf you prefer you can continue to use this world,\\nbut members only features will be unavailable here.';
            } else if (this.daysOfMembersRemaining > 0) {
                com.text =
                    'To extend or cancel a subscription:\\n1) Logout and return to the frontpage of this website.\\n2)Choose the relevant option from the \'membership\' section.\\n\\nNote: If you are a credit card subscriber a top-up payment will\\nautomatically be taken when 3 days credit remain.\\n(unless you cancel your subscription, which can be done at any time.)';
            } else {
                com.text = 'To start a subscripton:\\n1) Logout and return to the frontpage of this website.\\n2) Choose \'Start a new subscription\'';
            }
        } else if (clientCode === ClientCode.CC_RECOVERY_HELP) {
            // Java clientCode 668
            if (this.recoveriesLastChangedDay > this.currentDay) {
                com.text =
                    'To cancel this request:\\n1) Logout and return to the frontpage of this website.\\n2) Choose \'Cancel recovery questions\'.';
            } else {
                com.text =
                    'To change your recovery questions:\\n1) Logout and return to the frontpage of this website.\\n2) Choose \'Set new recovery questions\'.';
            }
        }
    }

    /** Java `getDateString(day)` — day index → "d-Mon-yyyy". */
    private getDateString(day: number): string {
        if (day > this.currentDay + 10) {
            return 'Unknown';
        }
        // Java: ((day + 11745L) * 86400000L)
        const ms = (day + 11745) * 86400000;
        const d = new Date(ms);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return d.getUTCDate() + '-' + months[d.getUTCMonth()] + '-' + d.getUTCFullYear();
    }

    private closeInterfaces(): void {
        // Java closeInterfaces: CLOSE_MODAL + unloadCom all
        this.out.p1Enc(ClientProt.CLOSE_MODAL);

        if (this.sideModalId !== -1) {
            this.unloadCom(this.sideModalId);
            this.sideModalId = -1;
            this.redrawSide = true;
            this.resumedPauseButton = false;
            this.redrawIcons = true;
        }

        if (this.chatModalId !== -1) {
            this.unloadCom(this.chatModalId);
            this.chatModalId = -1;
            this.redrawChat = true;
            this.resumedPauseButton = false;
        }

        if (this.fullscreenInterfaceId0 !== -1) {
            this.unloadCom(this.fullscreenInterfaceId0);
            this.fullscreenInterfaceId0 = -1;
            this.redrawFrame = true;
        }
        if (this.fullscreenInterfaceId1 !== -1) {
            this.unloadCom(this.fullscreenInterfaceId1);
            this.fullscreenInterfaceId1 = -1;
        }

        if (this.mainModalId !== -1) {
            this.unloadCom(this.mainModalId);
            this.mainModalId = -1;
        }
    }

    private handleInterfaceAction(com: IfType): boolean {
        const clientCode: number = com.clientCode;

        if (this.friendServerStatus === 2) {
            if (clientCode === ClientCode.CC_ADD_FRIEND) {
                this.redrawChat = true;
                this.dialogInputOpen = false;
                this.socialInputOpen = true;
                this.socialInput = '';
                this.socialInputType = 1;
                this.socialInputHeader = 'Enter name of friend to add to list';
            } else if (clientCode === ClientCode.CC_DEL_FRIEND) {
                this.redrawChat = true;
                this.dialogInputOpen = false;
                this.socialInputOpen = true;
                this.socialInput = '';
                this.socialInputType = 2;
                this.socialInputHeader = 'Enter name of friend to delete from list';
            }
        }

        if (clientCode === ClientCode.CC_LOGOUT) {
            this.logoutTimer = 250;
            return true;
        } else if (clientCode === ClientCode.CC_ADD_IGNORE) {
            this.redrawChat = true;
            this.dialogInputOpen = false;
            this.socialInputOpen = true;
            this.socialInput = '';
            this.socialInputType = 4;
            this.socialInputHeader = 'Enter name of player to add to list';
        } else if (clientCode === ClientCode.CC_DEL_IGNORE) {
            this.redrawChat = true;
            this.dialogInputOpen = false;
            this.socialInputOpen = true;
            this.socialInput = '';
            this.socialInputType = 5;
            this.socialInputHeader = 'Enter name of player to delete from list';
        } else if (clientCode >= ClientCode.CC_CHANGE_HEAD_L && clientCode <= ClientCode.CC_CHANGE_FEET_R) {
            const part: number = ((clientCode - 300) / 2) | 0;
            const direction: number = clientCode & 0x1;
            let kit: number = this.idkDesignPart[part];

            if (kit !== -1) {
                while (true) {
                    if (direction === 0) {
                        kit--;
                        if (kit < 0) {
                            kit = IdkType.numDefinitions - 1;
                        }
                    }

                    if (direction === 1) {
                        kit++;
                        if (kit >= IdkType.numDefinitions) {
                            kit = 0;
                        }
                    }

                    if (!IdkType.list[kit].disable && IdkType.list[kit].part === part + (this.idkDesignGender ? 0 : 7)) {
                        this.idkDesignPart[part] = kit;
                        this.idkDesignRedraw = true;
                        break;
                    }
                }
            }
        } else if (clientCode >= ClientCode.CC_RECOLOUR_HAIR_L && clientCode <= ClientCode.CC_RECOLOUR_SKIN_R) {
            const part: number = ((clientCode - 314) / 2) | 0;
            const direction: number = clientCode & 0x1;
            let colour: number = this.idkDesignColour[part];

            if (direction === 0) {
                colour--;
                if (colour < 0) {
                    colour = ClientPlayer.recol1d[part].length - 1;
                }
            }

            if (direction === 1) {
                colour++;
                if (colour >= ClientPlayer.recol1d[part].length) {
                    colour = 0;
                }
            }

            this.idkDesignColour[part] = colour;
            this.idkDesignRedraw = true;
        } else if (clientCode === ClientCode.CC_SWITCH_TO_MALE && !this.idkDesignGender) {
            this.idkDesignGender = true;
            this.validateCharacterDesign();
        } else if (clientCode === ClientCode.CC_SWITCH_TO_FEMALE && this.idkDesignGender) {
            this.idkDesignGender = false;
            this.validateCharacterDesign();
        } else if (clientCode === ClientCode.CC_ACCEPT_DESIGN) {
            this.out.p1Enc(ClientProt.IDK_SAVEDESIGN);
            this.out.p1(this.idkDesignGender ? 0 : 1);

            for (let i: number = 0; i < 7; i++) {
                this.out.p1(this.idkDesignPart[i]);
            }

            for (let i: number = 0; i < 5; i++) {
                this.out.p1(this.idkDesignColour[i]);
            }

            return true;
        } else if (clientCode === ClientCode.CC_MOD_MUTE) {
            this.reportAbuseMuteOption = !this.reportAbuseMuteOption;
        } else if (clientCode >= ClientCode.CC_REPORT_RULE1 && clientCode <= ClientCode.CC_REPORT_RULE13) {
            this.closeInterfaces();

            if (this.reportAbuseInput.length > 0) {
                writeReportAbuse(
                    this.out,
                    JString.toUserhash(this.reportAbuseInput),
                    clientCode - ClientCode.CC_REPORT_RULE1,
                    this.reportAbuseMuteOption
                );
            }
        }

        return false;
    }

    private validateCharacterDesign(): void {
        this.idkDesignRedraw = true;

        for (let i: number = 0; i < 7; i++) {
            this.idkDesignPart[i] = -1;

            for (let j: number = 0; j < IdkType.numDefinitions; j++) {
                if (!IdkType.list[j].disable && IdkType.list[j].part === i + (this.idkDesignGender ? 0 : 7)) {
                    this.idkDesignPart[i] = j;
                    break;
                }
            }
        }
    }

    // todo: order
    /**
     * Port of Client-Java `drawSidebar` (377).
     * Java: areaSidebar.bind; Pix3D.lineOffset = areaSidebarOffset; invback; tab/side interfaces;
     *       areaSidebar.draw(205, 553) → TS PixMap.draw(553, 205).
     */
    private drawSidebar(): void {
        this.areaSide?.setPixels();
        if (this.sideScanline) {
            Pix3D.scanline = this.sideScanline;
        }

        this.invback?.plotSprite(0, 0);

        if (this.sideModalId !== -1) {
            this.drawInterface(IfType.get(this.sideModalId), 0, 0, 0);
        } else if (this.sideIcon[this.activeIcon] !== -1) {
            this.drawInterface(IfType.get(this.sideIcon[this.activeIcon]), 0, 0, 0);
        }

        if (this.isMenuOpen && this.menuArea === 1) {
            this.drawMenu();
        }

        // Java areaSidebar.draw(205, 553, g) — y=205, x=553
        this.areaSide?.draw(553, 205);

        this.areaGame?.setPixels();
        if (this.gameScanline) {
            Pix3D.scanline = this.gameScanline;
        }
    }

    /**
     * Java `searchObjNames` — fill obj-search results (chatbackInputOpen == 3).
     * Matches certtemplate == -1 objects whose name contains every space-split term.
     */
    private searchObjNames(query: string | null): void {
        if (!query || query.length === 0) {
            this.objSearchResultCount = 0;
            return;
        }

        const terms: string[] = [];
        let rest = query;
        while (true) {
            const sp = rest.indexOf(' ');
            if (sp === -1) {
                const last = rest.trim();
                if (last.length > 0) {
                    terms.push(last.toLowerCase());
                }
                break;
            }
            const part = rest.substring(0, sp).trim();
            if (part.length > 0) {
                terms.push(part.toLowerCase());
            }
            rest = rest.substring(sp + 1);
        }

        this.objSearchResultCount = 0;
        outer: for (let id = 0; id < ObjType.numDefinitions; id++) {
            const obj = ObjType.list(id);
            if (obj.certtemplate !== -1 || !obj.name) {
                continue;
            }
            const name = obj.name.toLowerCase();
            for (let t = 0; t < terms.length; t++) {
                if (name.indexOf(terms[t]) === -1) {
                    continue outer;
                }
            }
            this.objSearchResults[this.objSearchResultCount] = name;
            this.objSearchResultCount++;
            if (this.objSearchResultCount >= this.objSearchResults.length) {
                return;
            }
        }
    }

    /**
     * Port of Client-Java `drawChat` (377).
     * Branch order: social → amount → name → obj-search → modalMessage → chatInterface → sticky/messages.
     * Java areaChatback.draw(357, 17) → TS draw(17, 357).
     * Java plotSprite(y,x) for mod icons; TS plotSprite(x,y).
     */
    private drawChat(): void {
        this.areaChat?.setPixels();
        if (this.chatScanline) {
            Pix3D.scanline = this.chatScanline;
        }

        this.chatback?.plotSprite(0, 0);

        if (this.socialInputOpen) {
            this.b12?.centreString(this.socialInputHeader, 239, 40, Colour.BLACK);
            this.b12?.centreString(this.socialInput + '*', 239, 60, Colour.DARKBLUE);
        } else if (this.chatbackInputOpen === 1 || this.dialogInputOpen) {
            // Java chatbackInputOpen == 1
            this.b12?.centreString('Enter amount:', 239, 40, Colour.BLACK);
            this.b12?.centreString(this.dialogInput + '*', 239, 60, Colour.DARKBLUE);
        } else if (this.chatbackInputOpen === 2) {
            // Java chatbackInputOpen == 2
            this.b12?.centreString('Enter name:', 239, 40, Colour.BLACK);
            this.b12?.centreString(this.dialogInput + '*', 239, 60, Colour.DARKBLUE);
        } else if (this.chatbackInputOpen === 3) {
            // Java chatbackInputOpen == 3 — object name search list
            if (this.dialogInput !== this.objSearchLastQuery) {
                this.searchObjNames(this.dialogInput);
                this.objSearchLastQuery = this.dialogInput;
            }
            const font: PixFont | null = this.p12;
            Pix2D.setClipping(0, 0, 463, 77);
            for (let i = 0; i < this.objSearchResultCount; i++) {
                const y = i * 14 + 18 - this.objSearchScrollPos;
                if (y > 0 && y < 110) {
                    font?.centreString(this.objSearchResults[i] ?? '', 239, y, Colour.BLACK);
                }
            }
            Pix2D.resetClipping();
            if (this.objSearchResultCount > 5) {
                this.drawScrollbar(463, 0, this.objSearchScrollPos, this.objSearchResultCount * 14 + 7, 77);
            }
            if (this.dialogInput.length === 0) {
                this.b12?.centreString('Enter object name', 239, 40, Colour.BLUE);
            } else if (this.objSearchResultCount === 0) {
                this.b12?.centreString('No matching objects found, please shorten search', 239, 40, Colour.BLACK);
            }
            font?.centreString(this.dialogInput + '*', 239, 90, Colour.BLACK);
            Pix2D.hline(0, 77, 479, Colour.BLACK);
        } else if (this.tutComMessage) {
            // Java modalMessage
            this.b12?.centreString(this.tutComMessage, 239, 40, Colour.BLACK);
            this.b12?.centreString('Click to continue', 239, 60, Colour.DARKBLUE);
        } else if (this.chatModalId !== -1) {
            this.drawInterface(IfType.get(this.chatModalId), 0, 0, 0);
        } else if (this.tutComId === -1) {
            // Java stickyChatInterfaceId == -1 → free chat messages
            const font: PixFont | null = this.p12;
            let line: number = 0;

            // Java setClipping(top=0, left=0, bottom=77, right=463) → TS (x1,y1,x2,y2)
            Pix2D.setClipping(0, 0, 463, 77);

            for (let i: number = 0; i < 100; i++) {
                const message: string | null = this.chatText[i];
                if (!message) {
                    continue;
                }

                const type: number = this.chatType[i];
                // Java: 70 - var6 * 14 + chatScrollOffset
                const y: number = 70 - line * 14 + this.chatScrollPos;

                let sender = this.chatUsername[i];
                let modlevel = 0;
                if (sender && sender.startsWith('@cr1@')) {
                    sender = sender.substring(5);
                    modlevel = 1;
                }
                if (sender && sender.startsWith('@cr2@')) {
                    sender = sender.substring(5);
                    modlevel = 2;
                }

                if (type === 0) {
                    if (y > 0 && y < 110) {
                        font?.drawString(message, 4, y, Colour.BLACK);
                    }
                    line++;
                }
                if ((type === 1 || type === 2) && (type === 1 || this.chatPublicMode === 0 || (this.chatPublicMode === 1 && this.isFriend(sender)))) {
                    if (y > 0 && y < 110) {
                        let x = 4;
                        if (modlevel === 1) {
                            // Java plotSprite(var10-12, var13) → (y-12, x)
                            this.modIcons[0].plotSprite(x, y - 12);
                            x += 14;
                        }
                        if (modlevel === 2) {
                            this.modIcons[1].plotSprite(x, y - 12);
                            x += 14;
                        }

                        font?.drawString(sender + ':', x, y, Colour.BLACK);
                        x += (font?.stringWid(sender) ?? 0) + 8;
                        font?.drawString(message, x, y, Colour.BLUE);
                    }
                    line++;
                }
                if ((type === 3 || type === 7) && this.splitPrivateChat === 0 && (type === 7 || this.chatPrivateMode === 0 || (this.chatPrivateMode === 1 && this.isFriend(sender)))) {
                    if (y > 0 && y < 110) {
                        let x = 4;
                        font?.drawString('From', x, y, Colour.BLACK);
                        x += font?.stringWid('From ') ?? 0;

                        if (modlevel === 1) {
                            this.modIcons[0].plotSprite(x, y - 12);
                            x += 14;
                        }
                        if (modlevel === 2) {
                            this.modIcons[1].plotSprite(x, y - 12);
                            x += 14;
                        }

                        font?.drawString(sender + ':', x, y, Colour.BLACK);
                        x += (font?.stringWid(sender) ?? 0) + 8;
                        font?.drawString(message, x, y, Colour.DARKRED);
                    }
                    line++;
                }
                if (type === 4 && (this.chatTradeMode === 0 || (this.chatTradeMode === 1 && this.isFriend(sender)))) {
                    if (y > 0 && y < 110) {
                        font?.drawString(sender + ' ' + message, 4, y, 0x800080);
                    }
                    line++;
                }
                if (type === 5 && this.splitPrivateChat === 0 && this.chatPrivateMode < 2) {
                    if (y > 0 && y < 110) {
                        font?.drawString(message, 4, y, Colour.DARKRED);
                    }
                    line++;
                }
                if (type === 6 && this.splitPrivateChat === 0 && this.chatPrivateMode < 2) {
                    if (y > 0 && y < 110) {
                        font?.drawString('To ' + sender + ':', 4, y, Colour.BLACK);
                        font?.drawString(message, (font?.stringWid('To ' + sender) ?? 0) + 12, y, Colour.DARKRED);
                    }
                    line++;
                }
                if (type === 8 && (this.chatTradeMode === 0 || (this.chatTradeMode === 1 && this.isFriend(sender)))) {
                    if (y > 0 && y < 110) {
                        font?.drawString(sender + ' ' + message, 4, y, 0x7e3200);
                    }
                    line++;
                }
            }

            Pix2D.resetClipping();

            this.chatScrollHeight = line * 14 + 7;
            if (this.chatScrollHeight < 78) {
                this.chatScrollHeight = 78;
            }

            // Java drawScrollbar(scroll, 463, 77, height, 0) → TS (x=463, y=0, scrollY, scrollHeight, height=77)
            this.drawScrollbar(463, 0, this.chatScrollHeight - this.chatScrollPos - 77, this.chatScrollHeight, 77);

            let username: string;
            if (this.localPlayer == null || this.localPlayer.name == null) {
                username = JString.toScreenName(this.loginUser);
            } else {
                username = this.localPlayer.name;
            }

            font?.drawString(username + ':', 4, 90, Colour.BLACK);
            font?.drawString(this.chatInput + '*', (font?.stringWid(username + ': ') ?? 0) + 6, 90, Colour.BLUE);

            // Java hline(x=0, colour=0, y=77, width=479)
            Pix2D.hline(0, 77, 479, Colour.BLACK);
        } else {
            // Java stickyChatInterfaceId != -1
            this.drawInterface(IfType.get(this.tutComId), 0, 0, 0);
        }

        if (this.isMenuOpen && this.menuArea === 2) {
            this.drawMenu();
        }

        // Java areaChatback.draw(357, 17) → y=357, x=17
        this.areaChat?.draw(17, 357);

        this.areaGame?.setPixels();
        if (this.gameScanline) {
            Pix3D.scanline = this.gameScanline;
        }
    }

    /**
     * Port of Client-Java `drawMinimap` (377).
     * Java areaMapback.draw(4, 550) is done by caller (gameDraw); this only paints into areaMap.
     * Restores viewport bind + gameScanline like Java areaViewport.bind + lineOffset.
     */
    private drawMinimap(): void {
        if (!this.localPlayer) {
            return;
        }

        this.areaMap?.setPixels();

        if (this.minimapState === 2) {
            // Java: black out mapback zeros, compass only
            if (this.mapback !== null) {
                const mask = this.mapback.data;
                const pixels = Pix2D.pixels;
                const len = mask.length;
                for (let i = 0; i < len; i++) {
                    if (mask[i] === 0) {
                        pixels[i] = 0;
                    }
                }
            }

            // Java drawRotatedMasked(0, 33, 25, 33, lengths, 0, yaw, 256, offsets, 25)
            this.compass?.scanlineRotatePlotSprite(0, 0, 33, 33, 25, 25, this.orbitCameraYaw, 256, this.compassMaskLineOffsets, this.compassMaskLineLengths);

            this.areaGame?.setPixels();
            if (this.gameScanline) {
                Pix3D.scanline = this.gameScanline;
            }
            return;
        }

        const angle: number = (this.orbitCameraYaw + this.macroMinimapAngle) & 0x7ff;
        // Java: localPlayer.field1157/32 + 48; 464 - field1158/32
        let anchorX: number = ((this.localPlayer.x / 32) | 0) + 48;
        let anchorY: number = 464 - ((this.localPlayer.z / 32) | 0);

        // Java drawRotatedMasked(5, 151, var7, 146, lengths, 25, angle, zoom+256, offsets, var9)
        this.minimap?.scanlineRotatePlotSprite(25, 5, 146, 151, anchorX, anchorY, angle, this.macroMinimapZoom + 256, this.minimapMaskLineOffsets, this.minimapMaskLineLengths);
        this.compass?.scanlineRotatePlotSprite(0, 0, 33, 33, 25, 25, this.orbitCameraYaw, 256, this.compassMaskLineOffsets, this.compassMaskLineLengths);

        for (let i: number = 0; i < this.activeMapFunctionCount; i++) {
            anchorX = this.activeMapFunctionX[i] * 4 + 2 - ((this.localPlayer.x / 32) | 0);
            anchorY = this.activeMapFunctionZ[i] * 4 + 2 - ((this.localPlayer.z / 32) | 0);
            // Java drawOnMinimap(dz, sprite, dx)
            this.drawOnMinimap(anchorY, this.activeMapFunctions[i], anchorX);
        }

        for (let ltx: number = 0; ltx < BuildArea.SIZE; ltx++) {
            for (let ltz: number = 0; ltz < BuildArea.SIZE; ltz++) {
                const objs = this.groundObj[this.minusedlevel][ltx][ltz];
                if (objs) {
                    anchorX = ltx * 4 + 2 - ((this.localPlayer.x / 32) | 0);
                    anchorY = ltz * 4 + 2 - ((this.localPlayer.z / 32) | 0);
                    // Java imageMapdot0
                    this.drawOnMinimap(anchorY, this.mapdots1, anchorX);
                }
            }
        }

        for (let i: number = 0; i < this.npcCount; i++) {
            const npc: ClientNpc | null = this.npc[this.npcIds[i]];
            // Java: multi resolve (method476) then field1439 minimap && field1434 active
            const ntype = npc?.type?.activeType() ?? null;
            if (npc && npc.isReady() && ntype && ntype.minimap && ntype.active) {
                anchorX = ((npc.x / 32) | 0) - ((this.localPlayer.x / 32) | 0);
                anchorY = ((npc.z / 32) | 0) - ((this.localPlayer.z / 32) | 0);
                // Java imageMapdot1
                this.drawOnMinimap(anchorY, this.mapdots2, anchorX);
            }
        }

        for (let i: number = 0; i < this.playerCount; i++) {
            const player: ClientPlayer | null = this.players[this.playerIds[i]];
            if (player && player.isReady() && player.name) {
                anchorX = ((player.x / 32) | 0) - ((this.localPlayer.x / 32) | 0);
                anchorY = ((player.z / 32) | 0) - ((this.localPlayer.z / 32) | 0);

                // Java: separate friend vs team flags
                let friend: boolean = false;
                const userhash: bigint = JString.toUserhash(player.name);
                for (let j: number = 0; j < this.friendCount; j++) {
                    if (userhash === this.friendUserhash[j] && this.friendNodeId[j] !== 0) {
                        friend = true;
                        break;
                    }
                }

                let team: boolean = false;
                if (this.localPlayer.team !== 0 && player.team !== 0 && this.localPlayer.team === player.team) {
                    team = true;
                }

                if (friend) {
                    // Java imageMapdot3
                    this.drawOnMinimap(anchorY, this.mapdots4, anchorX);
                } else if (team) {
                    // Java imageMapdot4
                    this.drawOnMinimap(anchorY, this.mapdots5, anchorX);
                } else {
                    // Java imageMapdot2
                    this.drawOnMinimap(anchorY, this.mapdots3, anchorX);
                }
            }
        }

        if (this.hintType !== 0 && Client.loopCycle % 20 < 10) {
            if (this.hintType === 1 && this.hintNpc >= 0 && this.hintNpc < this.npc.length) {
                const npc = this.npc[this.hintNpc];
                if (npc != null) {
                    const dx = ((npc.x / 32) | 0) - ((this.localPlayer.x / 32) | 0);
                    const dy = ((npc.z / 32) | 0) - ((this.localPlayer.z / 32) | 0);
                    // Java drawMinimapArrow(dy, imageMapmarker1, dx)
                    this.drawMinimapArrow(dx, dy, this.mapmarker2);
                }
            }
            if (this.hintType === 2) {
                const dx = (this.hintTileX - this.mapBuildBaseX) * 4 + 2 - ((this.localPlayer.x / 32) | 0);
                const dy = (this.hintTileZ - this.mapBuildBaseZ) * 4 + 2 - ((this.localPlayer.z / 32) | 0);
                this.drawMinimapArrow(dx, dy, this.mapmarker2);
            }
            if (this.hintType === 10 && this.hintPlayer >= 0 && this.hintPlayer < this.players.length) {
                const player = this.players[this.hintPlayer];
                if (player != null) {
                    const dx = ((player.x / 32) | 0) - ((this.localPlayer.x / 32) | 0);
                    const dy = ((player.z / 32) | 0) - ((this.localPlayer.z / 32) | 0);
                    this.drawMinimapArrow(dx, dy, this.mapmarker2);
                }
            }
        }

        if (this.minimapFlagX !== 0) {
            anchorX = this.minimapFlagX * 4 + 2 - ((this.localPlayer.x / 32) | 0);
            anchorY = this.minimapFlagZ * 4 + 2 - ((this.localPlayer.z / 32) | 0);
            // Java imageMapmarker0
            this.drawOnMinimap(anchorY, this.mapmarker1, anchorX);
        }

        // Java fillRect(h=3, y=78, colour=WHITE, w=3, x=97)
        Pix2D.fillRect(97, 78, 3, 3, Colour.WHITE);

        this.areaGame?.setPixels();
        if (this.gameScanline) {
            Pix3D.scanline = this.gameScanline;
        }
    }

    drawMinimapArrow(dx: number, dy: number, image: Pix32 | null) {
        if (!image) {
            return;
        }

        const distance = dx * dx + dy * dy;
        if (distance <= 4225 || distance >= 90000) {
            this.drawOnMinimap(dy, image, dx);
            return;
        }

        const angle: number = (this.orbitCameraYaw + this.macroMinimapAngle) & 0x7ff;

        let sinAngle: number = Pix3D.sinTable[angle];
        let cosAngle: number = Pix3D.cosTable[angle];

        sinAngle = ((sinAngle * 256) / (this.macroMinimapZoom + 256)) | 0;
        cosAngle = ((cosAngle * 256) / (this.macroMinimapZoom + 256)) | 0;

        const x: number = (dy * sinAngle + dx * cosAngle) >> 16;
        const y: number = (dy * cosAngle - dx * sinAngle) >> 16;

        const var13 = Math.atan2(x, y);
        const var15 = (Math.sin(var13) * 63.0) | 0;
        const var16 = (Math.cos(var13) * 57.0) | 0;

        this.mapedge?.rotatePlotSprite(var15 + 94 + 4 - 10, 83 - var16 - 20, 20, 20, 15, 15, var13, 256);
    }

    private drawOnMinimap(dy: number, image: Pix32 | null, dx: number): void {
        if (!image) {
            return;
        }

        const distance: number = dx * dx + dy * dy;
        if (distance > 6400) {
            return;
        }

        const angle: number = (this.orbitCameraYaw + this.macroMinimapAngle) & 0x7ff;

        let sinAngle: number = Pix3D.sinTable[angle];
        let cosAngle: number = Pix3D.cosTable[angle];

        sinAngle = ((sinAngle * 256) / (this.macroMinimapZoom + 256)) | 0;
        cosAngle = ((cosAngle * 256) / (this.macroMinimapZoom + 256)) | 0;

        const x: number = (dy * sinAngle + dx * cosAngle) >> 16;
        const y: number = (dy * cosAngle - dx * sinAngle) >> 16;

        if (distance > 2500 && this.mapback) {
            image.scanlinePlotSprite(this.mapback, x + 94 - ((image.owi / 2) | 0) + 4, 83 - y - ((image.ohi / 2) | 0) - 4);
        } else {
            image.plotSprite(x + 94 - ((image.owi / 2) | 0) + 4, 83 - y - ((image.ohi / 2) | 0) - 4);
        }
    }

    /** Java 377 `addMessage(sender, text, type)`. */
    private addMessage(sender: string, text: string, type: number): void {
        if (type === 0 && this.tutComId !== -1) {
            this.tutComMessage = text;
            this.mouseClickButton = 0;
        }

        if (this.chatModalId === -1) {
            this.redrawChat = true;
        }

        for (let i: number = 99; i > 0; i--) {
            this.chatType[i] = this.chatType[i - 1];
            this.chatUsername[i] = this.chatUsername[i - 1];
            this.chatText[i] = this.chatText[i - 1];
        }

        this.chatType[0] = type;
        this.chatUsername[0] = sender;
        this.chatText[0] = text;
    }

    private isFriend(username: string | null): boolean {
        if (!username) {
            return false;
        }

        for (let i: number = 0; i < this.friendCount; i++) {
            if (username.toLowerCase() === this.friendUsername[i]?.toLowerCase()) {
                return true;
            }
        }

        if (!this.localPlayer) {
            return false;
        }

        return username.toLowerCase() === this.localPlayer.name?.toLowerCase();
    }

    private addFriend(userhash: bigint): void {
        if (userhash === 0n) {
            return;
        }

        if (this.friendCount >= 100 && this.membersAccount != 1) {
            this.addMessage('', 'Your friendlist is full. Max of 100 for free users, and 200 for members', 0);
            return;
        } else if (this.friendCount >= 200) {
            this.addMessage('', 'Your friendlist is full. Max of 100 for free users, and 200 for members', 0);
            return;
        }

        const displayName: string = JString.toScreenName(JString.toRawUsername(userhash));
        for (let i: number = 0; i < this.friendCount; i++) {
            if (this.friendUserhash[i] === userhash) {
                this.addMessage('', displayName + ' is already on your friend list', 0);
                return;
            }
        }

        for (let i: number = 0; i < this.ignoreCount; i++) {
            if (this.ignoreUserhash[i] === userhash) {
                this.addMessage('', 'Please remove ' + displayName + ' from your ignore list first', 0);
                return;
            }
        }

        if (!this.localPlayer || !this.localPlayer.name) {
            return;
        }

        if (displayName !== this.localPlayer.name) {
            this.friendUsername[this.friendCount] = displayName;
            this.friendUserhash[this.friendCount] = userhash;
            this.friendNodeId[this.friendCount] = 0;
            this.friendCount++;

            this.redrawSide = true;

            this.out.p1Enc(ClientProt.FRIENDLIST_ADD);
            this.out.p8(userhash);
        }
    }

    private addIgnore(userhash: bigint): void {
        if (userhash === 0n) {
            return;
        }

        if (this.ignoreCount >= 100) {
            this.addMessage('', 'Your ignore list is full. Max of 100 hit', 0);
            return;
        }

        const displayName: string = JString.toScreenName(JString.toRawUsername(userhash));
        for (let i: number = 0; i < this.ignoreCount; i++) {
            if (this.ignoreUserhash[i] === userhash) {
                this.addMessage('', displayName + ' is already on your ignore list', 0);
                return;
            }
        }

        for (let i: number = 0; i < this.friendCount; i++) {
            if (this.friendUserhash[i] === userhash) {
                this.addMessage('', 'Please remove ' + displayName + ' from your friend list first', 0);
                return;
            }
        }

        this.ignoreUserhash[this.ignoreCount++] = userhash;
        this.redrawSide = true;

        this.out.p1Enc(ClientProt.IGNORELIST_ADD);
        this.out.p8(userhash);
    }

    private removeFriend(userhash: bigint): void {
        if (userhash === 0n) {
            return;
        }

        for (let i: number = 0; i < this.friendCount; i++) {
            if (this.friendUserhash[i] === userhash) {
                this.friendCount--;
                this.redrawSide = true;

                for (let j: number = i; j < this.friendCount; j++) {
                    this.friendUsername[j] = this.friendUsername[j + 1];
                    this.friendNodeId[j] = this.friendNodeId[j + 1];
                    this.friendUserhash[j] = this.friendUserhash[j + 1];
                }

                this.out.p1Enc(ClientProt.FRIENDLIST_DEL);
                this.out.p8(userhash);
                return;
            }
        }
    }

    private removeIgnore(userhash: bigint): void {
        if (userhash === 0n) {
            return;
        }

        for (let i: number = 0; i < this.ignoreCount; i++) {
            if (this.ignoreUserhash[i] === userhash) {
                this.ignoreCount--;
                this.redrawSide = true;

                for (let j: number = i; j < this.ignoreCount; j++) {
                    this.ignoreUserhash[j] = this.ignoreUserhash[j + 1];
                }

                this.out.p1Enc(ClientProt.IGNORELIST_DEL);
                this.out.p8(userhash);
                return;
            }
        }
    }

    // ----

    /// touch controls
    private startedInGame: boolean = false;
    private startedInSide: boolean = false;
    private startedInChat: boolean = false;
    private ttime: number = -1;
    // start
    private sx: number = 0;
    private sy: number = 0;
    // mouse
    private mx: number = 0;
    private my: number = 0;
    // new
    private nx: number = 0;
    private ny: number = 0;
    private dragging: boolean = false;
    private panning: boolean = false;

    override pointerDown(x: number, y: number, e: PointerEvent) {
        if (MobileKeyboard.isWithinCanvasKeyboard(x, y) && !this.exceedsGrabThreshold(20)) {
            MobileKeyboard.captureMouseDown(x, y);
            return;
        }

        if (e.pointerType !== 'mouse') {
            // custom: touchscreen support
            // we don't acknowledge the first press as a click, instead we interpret the user's gesture on release

            this.idleTimer = performance.now();
            this.nextMouseClickX = -1;
            this.nextMouseClickY = -1;
            this.nextMouseClickButton = 0;
            this.mouseX = x;
            this.mouseY = y;
            this.mouseButton = 0;

            this.sx = this.nx = this.mx = e.screenX | 0;
            this.sy = this.ny = this.my = e.screenY | 0;
            this.ttime = e.timeStamp;

            this.startedInGame = this.insideGame();
            this.startedInSide = this.insideSide();
            this.startedInChat = this.insideChat();
        }
    }

    override mouseUp(x: number, y: number, e: MouseEvent) {
        this.idleTimer = performance.now();
        this.mouseButton = 0;

        // custom: up event comes before and potentially without move event
        this.mouseX = x;
        this.mouseY = y;
    }

    override pointerUp(x: number, y: number, e: PointerEvent) {
        if (MobileKeyboard.isWithinCanvasKeyboard(x, y) && !this.exceedsGrabThreshold(20)) {
            MobileKeyboard.captureMouseUp(x, y);
            return;
        }

        if (e.pointerType !== 'mouse') {
            // custom: touchscreen support
            // we don't acknowledge the first press as a click, instead we interpret the user's gesture on release

            this.idleTimer = performance.now();
            this.mouseX = x;
            this.mouseY = y;

            if (this.dragging) {
                this.dragging = false;

                this.nextMouseClickX = -1;
                this.nextMouseClickY = -1;
                this.nextMouseClickButton = 0;
                this.mouseButton = 0;
            } else if (this.panning) {
                // ignore up events if the player was moving the camera
                this.panning = false;

                // release all arrow keys
                this.keyHeld[1] = 0;
                this.keyHeld[2] = 0;
                this.keyHeld[3] = 0;
                this.keyHeld[4] = 0;
                return;
            } else {
                if (!MobileKeyboard.isDisplayed() && this.insideMobileInput()) {
                    // show keyboard when tapping in an input area
                    MobileKeyboard.show(x, y, e.clientX, e.clientY);
                } else if (MobileKeyboard.isDisplayed() && !MobileKeyboard.isWithinCanvasKeyboard(x, y)) {
                    // hide keyboard when tapping outside of an input area
                    MobileKeyboard.hide();
                    this.refresh();
                }

                // within click threshold: activate mouse button
                this.nextMouseClickX = x;
                this.nextMouseClickY = y;
                this.nextMouseClickTime = performance.now();

                const longPress: boolean = e.timeStamp >= this.ttime + 500;
                if (longPress) {
                    this.nextMouseClickButton = 2;
                    this.mouseButton = 2;
                } else {
                    this.nextMouseClickButton = 1;
                    this.mouseButton = 1;
                }

                // release after a client cycle has passed
                setTimeout(() => {
                    this.mouseButton = 0;
                }, 40);
            }
        }
    }

    override pointerEnter(x: number, y: number, e: PointerEvent) {
        if (e.pointerType === 'mouse') {
            this.mouseX = x;
            this.mouseY = y;
        } else {
            // custom: touchscreen support

            this.idleTimer = performance.now();
            this.nextMouseClickX = -1;
            this.nextMouseClickY = -1;
            this.nextMouseClickButton = 0;
            this.mouseX = x;
            this.mouseY = y;
            this.mouseButton = 0;

            this.sx = this.nx = this.mx = e.screenX | 0;
            this.sy = this.ny = this.my = e.screenY | 0;
            this.ttime = e.timeStamp;

            this.startedInGame = this.insideGame();
            this.startedInSide = this.insideSide();
        }
    }

    override pointerLeave(e: PointerEvent) {
        if (e.pointerType === 'mouse') {
            this.idleTimer = performance.now();
            this.mouseX = -1;
            this.mouseY = -1;

            // custom: moving off-canvas may have a stuck mouse event
            this.nextMouseClickX = -1;
            this.nextMouseClickY = -1;
            this.nextMouseClickButton = 0;
            this.mouseButton = 0;
        } else {
            // custom: touchscreen support
            this.idleTimer = performance.now();

            // release all arrow keys
            this.keyHeld[1] = 0;
            this.keyHeld[2] = 0;
            this.keyHeld[3] = 0;
            this.keyHeld[4] = 0;
        }
    }

    override pointerMove(x: number, y: number, e: PointerEvent) {
        if (e.pointerType === 'mouse') {
            this.idleTimer = performance.now();
            this.mouseX = x;
            this.mouseY = y;
        } else {
            // custom: touchscreen support
            this.idleTimer = performance.now();
            this.mouseX = x;
            this.mouseY = y;

            this.nx = e.screenX | 0;
            this.ny = e.screenY | 0;

            if (this.dragging) {
                // no-op
            } else if (MobileKeyboard.isWithinCanvasKeyboard(x, y) && this.exceedsGrabThreshold(20)) {
                MobileKeyboard.notifyTouchMove(x, y);
            } else if (this.startedInGame && !this.isGameObscured() && this.exceedsGrabThreshold(20)) {
                // moving camera
                this.panning = true;

                // emulate arrow keys:
                if (this.mx - this.nx > 0) {
                    // right
                    this.keyHeld[1] = 0;
                    this.keyHeld[2] = 1;
                } else if (this.mx - this.nx < 0) {
                    // left
                    this.keyHeld[1] = 1;
                    this.keyHeld[2] = 0;
                }

                if (this.my - this.ny > 0) {
                    // down
                    this.keyHeld[3] = 0;
                    this.keyHeld[4] = 1;
                } else if (this.my - this.ny < 0) {
                    // up
                    this.keyHeld[3] = 1;
                    this.keyHeld[4] = 0;
                }
            } else if (this.startedInSide || this.startedInChat || this.isGameObscured()) {
                if (!this.dragging && this.exceedsGrabThreshold(5)) {
                    this.dragging = true;

                    this.nextMouseClickX = x;
                    this.nextMouseClickY = y;
                    this.nextMouseClickButton = 1;
                    this.mouseButton = 1;
                }
            }

            this.mx = this.nx;
            this.my = this.ny;
        }
    }

    private exceedsGrabThreshold(size: number) {
        return Math.abs(this.sx - this.nx) > size || Math.abs(this.sy - this.ny) > size;
    }

    private isGameObscured(): boolean {
        return this.mainModalId !== -1;
    }

    private insideMobileInput(): boolean {
        return this.insideChatInput() || this.insideChatPopup() || this.insideLoginUser() || this.insideLoginPass() || this.insideReportAbuse();
    }

    private insideGame() {
        const x1: number = 4;
        const y1: number = 4;
        const x2: number = x1 + 512;
        const y2: number = y1 + 334;
        return this.ingame && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    private insideSide() {
        const x1: number = 553;
        const y1: number = 205;
        const x2: number = x1 + 190;
        const y2: number = y1 + 261;
        return this.ingame && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    private insideChat() {
        const x1: number = 480;
        const y1: number = 357;
        const x2: number = x1 + 16;
        const y2: number = y1 + 77;
        return this.ingame && !this.dialogInputOpen && !this.socialInputOpen && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    private insideChatInput() {
        const x1: number = 17;
        const y1: number = 434;
        const x2: number = x1 + 479;
        const y2: number = y1 + 26;
        return this.ingame && this.chatModalId === -1 && !this.dialogInputOpen && !this.socialInputOpen && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    protected insideChatPopup() {
        const x1: number = 17;
        const y1: number = 357;
        const x2: number = x1 + 479;
        const y2: number = y1 + 96;
        return this.ingame && (this.dialogInputOpen || this.socialInputOpen) && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    private insideReportAbuse() {
        if (!this.ingame) {
            return false;
        }

        if (this.mainModalId === -1 || this.reportAbuseComId === -1) {
            return false;
        }

        if (this.mainModalId !== this.reportAbuseComId) {
            return false;
        }

        const x1: number = 87;
        const y1: number = 119;
        const x2: number = x1 + 348;
        const y2: number = y1 + 37;
        return this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    private insideLoginUser() {
        const x1: number = 280;
        const y1: number = 233;
        const x2: number = x1 + 190;
        const y2: number = y1 + 31;
        return !this.ingame && this.loginscreen === 2 && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }

    private insideLoginPass() {
        const x1: number = 280;
        const y1: number = 264;
        const x2: number = x1 + 278;
        const y2: number = y1 + 20;
        return !this.ingame && this.loginscreen === 2 && this.mouseX >= x1 && this.mouseX <= x2 && this.mouseY >= y1 && this.mouseY <= y2;
    }
}
