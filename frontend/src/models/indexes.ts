import { defer, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import Axios from 'axios';
import { MapOperator } from 'rxjs/internal/operators/map';
import TypedFastBitSet from 'fastbitset';

function unpack(data: string): Int32Array {
  const binary = atob(data);
  const values = new Int32Array(binary.length / 4);
  for (let i = 0; i < binary.length; i += 4) {
    // Java writes these bytes as big endian, so the order of the bytes must be reversed.
    // Using a typed array is dependent on the endianness of the system so to avoid that
    // all together, we write directly to the int32 array.
    const a = binary.charCodeAt(i) | 0;
    const b = binary.charCodeAt(i + 1) | 0;
    const c = binary.charCodeAt(i + 2) | 0;
    const d = binary.charCodeAt(i + 3) | 0;
    values[(i / 4) | 0] = (a << 24) + (b << 16) + (c << 8) + d;
  }
  return values;
}

function toCardinalityTable(
  n: number,
  m: number,
  data: Int32Array,
): number[][] {
  const table = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) {
      row.push(0);
    }
    table.push(row);
  }
  for (let i = 0; i < data.length; ) {
    const cardinality = data[i];
    const count = data[i + 1];
    for (let j = 0; j < count; j++) {
      const packedIndex = data[i + j + 2];
      const courseIndex = (packedIndex / m) | 0;
      const termIndex = packedIndex % m;
      table[courseIndex][termIndex] = cardinality;
    }
    i += count + 2;
  }
  return table;
}

function toTotalCardinality(table: number[][]): number {
  let sum = 0;
  for (let i = 0; i < table.length; i++) {
    for (let j = 0; j < table[j].length; j++) {
      sum += table[i][j];
    }
  }
  return sum;
}

function getOrUnpack(
  map: Map<string, TypedFastBitSet | string>,
  unpacker: (data: string) => TypedFastBitSet,
  key: string,
) {
  if (!map.has(key)) {
    return new TypedFastBitSet();
  }
  const value = map.get(key);
  if (!(value instanceof TypedFastBitSet)) {
    const unpacked = unpacker(value);
    map.set(key, unpacked);
    return unpacked;
  }
  return value;
}

function keysWithoutMetadata<V>(map: Map<string, V>) {
  return Array.from(map.keys())
    .sort()
    .filter(key => key != '_metadata');
}

export default class Indexes {
  private readonly courses: string[];
  private readonly terms: string[];
  private readonly courseIndexes: Map<string, number>;
  private readonly termIndexes: Map<string, number>;
  private readonly sequences: Map<string, TypedFastBitSet | string>;
  private readonly departments: Map<string, TypedFastBitSet | string>;
  private readonly instructors: Map<string, TypedFastBitSet | string>;
  private readonly years: Map<string, TypedFastBitSet | string>;
  private readonly periods: Map<string, TypedFastBitSet | string>;
  private readonly cardinalityTable: number[][];
  private readonly courseOffsets: number[];
  private readonly totalCardinality: number;
  constructor(data: any) {
    this.courses = data.courses as string[];
    this.terms = data.terms as string[];
    this.courseIndexes = new Map<string, number>(
      this.courses.map((course, index) => [course, index] as [string, number]),
    );
    this.termIndexes = new Map<string, number>(
      this.terms.map((term, index) => [term, index] as [string, number]),
    );
    this.sequences = new Map<string, TypedFastBitSet | string>(
      Object.entries(data.sequences),
    );
    this.departments = new Map<string, TypedFastBitSet | string>(
      Object.entries(data.departments),
    );
    this.instructors = new Map<string, TypedFastBitSet | string>(
      Object.entries(data.instructors),
    );
    this.years = new Map<string, TypedFastBitSet | string>(
      Object.entries(data.years),
    );
    this.periods = new Map<string, TypedFastBitSet | string>(
      Object.entries(data.periods),
    );
    this.cardinalityTable = toCardinalityTable(
      this.courses.length,
      this.terms.length,
      unpack(data.cardinalities),
    );
    this.totalCardinality = toTotalCardinality(this.cardinalityTable);
    this.courseOffsets = this.cardinalityTable.map(row =>
      row.reduce((a, b) => a + b, 0),
    );
    for (let i = 1; i < this.courseOffsets.length; i++) {
      this.courseOffsets[i] += this.courseOffsets[i - 1];
    }
  }

  getTotalCardinality() {
    return this.totalCardinality;
  }

  getCourses(): string[] {
    return this.courses;
  }

  getTerms(): string[] {
    return this.terms;
  }

  getCourseOffsets(): number[] {
    return this.courseOffsets;
  }

  getBitSetForCourses(courses: string[]) {
    const result = new TypedFastBitSet();
    result.resize(this.getTotalCardinality());
    const indices = courses
      .map(course => this.courses.indexOf(course))
      .filter(index => index >= 0)
      .forEach(index => {
        const from = index > 0 ? this.courseOffsets[index - 1] : 0;
        const to = this.courseOffsets[index];
        for (let i = from; i < to; i++) {
          result.add(i);
        }
      });
    return result;
  }

  private unpackCourseIndex(data: string): TypedFastBitSet {
    const courses = new Set<number>(unpack(data));
    const result = new TypedFastBitSet();
    let index = 0;
    for (let i = 0; i < this.courses.length; i++) {
      const included = courses.has(i);
      for (let j = 0; j < this.terms.length; j++) {
        for (let k = 0; k < this.cardinalityTable[i][j]; k++, index++) {
          if (included) {
            result.add(index);
          }
        }
      }
    }
    return result;
  }

  private unpackTermIndex(data: string): TypedFastBitSet {
    const terms = new Set<number>(unpack(data));
    const result = new TypedFastBitSet();
    let index = 0;
    for (let j = 0; j < this.terms.length; j++) {
      const included = terms.has(j);
      for (let i = 0; i < this.courses.length; i++) {
        for (let k = 0; k < this.cardinalityTable[i][j]; k++, index++) {
          if (included) {
            result.add(index);
          }
        }
      }
    }
    return result;
  }

  private unpackSectionIndex(data: string): TypedFastBitSet {
    return new TypedFastBitSet(unpack(data));
  }

  getSequences(): string[] {
    return keysWithoutMetadata(this.sequences);
  }

  getSparseSequence(key: string): string[] {
    return Array.from(new Set<number>(unpack(this.sequences.get(key)))).map(
      i => this.courses[i],
    );
  }

  sequence(key: string): TypedFastBitSet {
    return getOrUnpack(this.sequences, x => this.unpackCourseIndex(x), key);
  }

  getDepartments(): string[] {
    return keysWithoutMetadata(this.departments);
  }

  department(key: string): TypedFastBitSet {
    return getOrUnpack(this.departments, x => this.unpackCourseIndex(x), key);
  }

  getInstructors(): string[] {
    return keysWithoutMetadata(this.instructors);
  }

  instructor(key: string): TypedFastBitSet {
    return getOrUnpack(this.instructors, x => this.unpackSectionIndex(x), key);
  }

  getPeriods(): string[] {
    return keysWithoutMetadata(this.periods);
  }

  period(key: string): TypedFastBitSet {
    return getOrUnpack(this.periods, x => this.unpackTermIndex(x), key);
  }

  periodIndex(key: number): TypedFastBitSet {
    return this.period(this.getPeriods()[key]);
  }

  getYears(): number[] {
    return keysWithoutMetadata(this.years).map(x => parseInt(x, 10));
  }

  year(key: number): TypedFastBitSet {
    return getOrUnpack(this.years, x => this.unpackTermIndex(x), `${key}`);
  }
}
