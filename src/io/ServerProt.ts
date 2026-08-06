/**
 * Server → client protocol for revision **377**.
 * IDs from Lost City Engine-TS ServerGameProt / ServerGameZoneProt (377-wip).
 * Lengths from Client-Java 377 Protocol.SERVERPROT_LENGTH.
 *
 * Base Client-TS was 289 — full remap required (silent logout = wrong sizes / LOGOUT misread).
 */
export const enum ServerProt {
    // interfaces
    IF_OPENCHAT = 109,
    IF_OPENMAIN_SIDE = 128,
    IF_CLOSE = 29,
    /** was IF_SETICON on 289 */
    IF_SETICON = 10, // IF_SETTAB
    IF_SETTAB = 10,
    /** was IF_SHOWICON on 289 */
    IF_SHOWICON = 252, // IF_SETTAB_ACTIVE
    IF_SETTAB_ACTIVE = 252,
    IF_OPENMAIN = 159,
    IF_OPENSIDE = 246,
    IF_OPENOVERLAY = 50,
    IF_OPENFULL = 253,

    // updating interfaces
    IF_SETANGLE = 186,
    IF_SETCOLOUR = 218,
    IF_SETHIDE = 82,
    IF_SETOBJECT = 21,
    IF_SETMODEL = 216,
    IF_SETROTATION = 18,
    IF_SETANIM = 2,
    IF_SETPLAYERHEAD = 255,
    IF_SETTEXT = 232,
    IF_SETNPCHEAD = 162,
    IF_SETPOSITION = 166,
    IF_SETSCROLLPOS = 200,

    // tutorial
    TUT_FLASH = 238,
    TUT_OPEN = 158,

    // inventory
    UPDATE_INV_STOP_TRANSMIT = 219,
    UPDATE_INV_FULL = 206,
    UPDATE_INV_PARTIAL = 134,

    // camera
    CAM_LOOKAT = 167,
    CAM_SHAKE = 67,
    CAM_MOVETO = 3,
    CAM_RESET = 148,

    // entity
    NPC_INFO = 71,
    PLAYER_INFO = 90,

    // social
    FRIENDLIST_LOADED = 251,
    MESSAGE_GAME = 63,
    UPDATE_IGNORELIST = 226,
    CHAT_FILTER_SETTINGS = 201,
    MESSAGE_PRIVATE = 135,
    UPDATE_FRIENDLIST = 78,

    // misc
    UNSET_MAP_FLAG = 61,
    UPDATE_RUNWEIGHT = 174,
    HINT_ARROW = 199,
    UPDATE_REBOOT_TIMER = 190,
    UPDATE_STAT = 49,
    UPDATE_RUNENERGY = 125,
    RESET_ANIMS = 13,
    UPDATE_PID = 126,
    LAST_LOGIN_INFO = 76,
    LOGOUT = 5,
    P_COUNTDIALOG = 58,
    SET_MULTIWAY = 233,
    SET_PLAYER_OP = 157,
    P_NAMEDIALOG = 6,
    MINIMAP_TOGGLE = 156,

    // maps
    REBUILD_NORMAL = 222,
    REBUILD_REGION = 53,

    // vars
    VARP_SMALL = 182,
    VARP_LARGE = 115,
    /** 377 uses RESET_CLIENT_VARCACHE; keep alias used by 289 handlers */
    VARP_SYNC = 113,
    RESET_CLIENT_VARCACHE = 113,

    // audio
    SYNTH_SOUND = 26,
    MIDI_SONG = 220,
    MIDI_JINGLE = 249,

    // zones
    UPDATE_ZONE_PARTIAL_FOLLOWS = 75,
    UPDATE_ZONE_FULL_FOLLOWS = 40,
    UPDATE_ZONE_PARTIAL_ENCLOSED = 183,

    // zone protocol
    P_LOCMERGE = 203,
    LOC_ANIM = 142,
    OBJ_DEL = 208,
    OBJ_REVEAL = 106,
    LOC_ADD_CHANGE = 152,
    MAP_PROJANIM = 181,
    LOC_DEL = 88,
    OBJ_COUNT = 121,
    MAP_ANIM = 59,
    OBJ_ADD = 107,
    SOUND_AREA = 41
}

/**
 * Client-Java 377 `Protocol.SERVERPROT_LENGTH` (index = opcode).
 * Verified byte-for-byte against `git show origin/377:src/main/java/jagex2/io/Protocol.java`.
 * Length 257 (opcodes 0–256). Values: fixed size, -1 = g1 length, -2 = g2 length.
 */
// prettier-ignore
export const ServerProtSizes = [
    0, 0, 4, 6, 0, 0, 0, 0, 0, 0, // 0-9
    3, 0, 0, 0, 0, 0, 0, 0, 6, 0, // 10-19
    0, 6, 0, 0, 0, 0, 5, 0, 0, 0, // 20-29
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 30-39
    2, 4, 0, 0, 0, 0, 0, 0, 0, 6, // 40-49
    2, 0, 0, -2, 0, 0, 0, 0, 0, 6, // 50-59
    0, 0, 0, -1, 0, 0, 0, 4, 0, 0, // 60-69
    0, -2, 0, 0, 0, 2, 23, 0, 9, 0, // 70-79
    0, 0, 3, 0, 0, 0, 0, 0, 2, 0, // 80-89
    -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 90-99
    0, 0, 0, 0, 0, 0, 7, 5, 0, 2, // 100-109
    0, 0, 0, 0, 0, 6, 0, 0, 0, 0, // 110-119
    0, 7, 0, 0, 0, 1, 3, 0, 4, 0, // 120-129
    0, 0, 0, 0, -2, -1, 0, 0, 0, 0, // 130-139
    0, 0, 4, 0, 0, 0, 0, 0, 0, 0, // 140-149
    0, 0, 4, 0, 0, 0, 1, -1, 2, 2, // 150-159
    0, 0, 4, 0, 0, 0, 6, 6, 0, 0, // 160-169
    0, 0, 0, 0, 2, 0, 0, 0, 0, 0, // 170-179
    0, 15, 3, -2, 0, 0, 8, 6, 0, 0, // 180-189
    2, 0, 0, 0, 0, 0, 0, 0, 0, 6, // 190-199
    4, 3, 0, 14, 0, 0, -2, 0, 3, 0, // 200-209
    0, 0, 0, 0, 0, 0, 4, 0, 4, 2, // 210-219
    2, 0, 4, 0, 0, 0, -2, 0, 0, 0, // 220-229
    0, 0, -2, 1, 0, 0, 0, 0, 1, 0, // 230-239
    0, 0, 0, 0, 0, 0, 2, 0, 0, 5, // 240-249
    0, 1, 1, 4, 0, 2, 0 // 250-256
];

/** Java name alias. */
export const SERVERPROT_LENGTH = ServerProtSizes;
