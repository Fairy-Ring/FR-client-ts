/**
 * Oracle: Client-Java 377 `jagex2.io.OnDemandRequest` (extends DoublyLinkable).
 * Fields: archive, file, data, cycle, urgent (default true).
 * 289 names: field726=cycle, field727=urgent.
 */
import Linkable2 from '#/datastruct/Linkable2.js';

export default class OnDemandRequest extends Linkable2 {
    archive: number = 0;
    file: number = 0;
    data: Uint8Array | null = null;
    cycle: number = 0;
    /** Java 377 default true (urgent request). */
    urgent: boolean = true;
}
