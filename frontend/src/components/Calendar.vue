<template>
  <div v-if="schedules">
    <svg width="100%" :height="height * 32 / 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="1" height="32" patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 1 0" fill="none" stroke="gray" stroke-width="0.5" />
        </pattern>
        <pattern id="subgrid" width="1" height="32" patternUnits="userSpaceOnUse">
          <path d="M 0 15.5 L 1 15.5" fill="none" stroke="gray" stroke-width="0.5" style="opacity:0.15"
          />
        </pattern>
      </defs>
      <svg width="8%" :height="times.length * 32 + 1">
        <g :style="{transform: 'translate(0, ' + (-(topShift * 32 / 60) + 24) + 'px)'}">
          <rect width="100%" height="100%" fill="url(#grid)" />
          <text text-anchor="end" x="80%" :y="(index * 32 + 16)" class="caption" v-for="(time, index) of times"
            :key="time">{{time}}</text>
          <template v-if="scheduleHints">
            <rect v-for="{cssClass, start, end} of scheduleHints" width="4" :style="{transform: 'translate(0, '+ (start * 32 / 60) + 'px)'}"
              :height="(end - start) * 32 / 60" :key="cssClass" :class="cssClass"
            />
          </template>
        </g>
      </svg>
      <svg width="92%" height="100%" x="8%">
        <svg :height="times.length * 32 + 1">
          <g :style="{transform: 'translate(0, ' + (-(topShift * 32 / 60) + 24) + 'px)'}">
            <rect width="100%" height="100%" fill="url(#grid)" />
            <rect width="100%" height="100%" fill="url(#subgrid)" />
            <transition-group name="fade-transition" tag="g">
              <svg v-for="({course, schedule, type, color}, index) of schedules" v-if="schedule.day >= DayOfWeek.MONDAY && schedule.day < DayOfWeek.SATURDAY"
                :key="course + ' ' + color + ' ' + schedule.day + ' ' + schedule.start" :x="(schedule.day * 20 - 20 + (index > 0 && overlaps(schedule, schedules[index - 1].schedule) ? 2 : 0)) + '%'"
                :width="index > 0 && overlaps(schedule, schedules[index - 1].schedule) ? '17%' : '19%'"
                :y="schedule.start * 32 / 60 / 60" :height="(schedule.end - schedule.start) * 32 / 60 / 60"
                class="block" @click="reset({query: course})" role="link">
                <rect width="100%" height="100%" :style="{fill: color, strokeWidth: 1, stroke: 'black'}"
                />
                <text text-anchor="left" x="4" y="16" class="caption">{{type || course}}</text>
              </svg>
            </transition-group>
            <text text-anchor="middle" class="caption" x="50%" style="fill: #9e9e9e" :y="(topShift + height / 2) * 32 / 60 - 8"
              v-if="!schedules || schedules.length == 0">(nothing scheduled)</text>
          </g>
        </svg>
      </svg>
      <rect width="100%" height="23" style="fill: white" />
      <svg width="92%" height="100%" x="8%">
        <text text-anchor="middle" :x="(index * 20 + 10) + '%'" y="10" class="body-2" v-for="(day, index) in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']"
          :key="day">
          {{day}}
        </text>
      </svg>
    </svg>
    <v-list two-line dense>
      <v-list-tile v-for="{course, section, activity, schedule, type, color, temporary} of legend"
        :key="color" class="legend-tile" @click.native="reset({query: course})">
        <v-list-tile-action>
          <v-chip small label :style="{backgroundColor: color, borderColor: 'black'}" class="ma-0 elevation-0"
          />
        </v-list-tile-action>
        <v-list-tile-content>
          <v-list-tile-title>{{course}}
            <span class="caption grey--text" v-if="section">&sect;{{section}}
              <span class="caption grey--text" v-if="activity">&middot; {{activity}}</span>
            </span>
          </v-list-tile-title>
          <v-list-tile-sub-title>
            <course-name>{{course}}</course-name>
          </v-list-tile-sub-title>
        </v-list-tile-content>
        <v-list-tile-action v-if="temporary">
          <v-chip small class="primary white--text">Planned</v-chip>
        </v-list-tile-action>
      </v-list-tile>
    </v-list>
  </div>
</template>

<script>
import { combineLatest, of } from "rxjs";
import CourseName from "@/components/CourseName";
import { mapState, mapActions, mapGetters } from "vuex";
import { map, debounceTime, switchMap, tap, concat } from "rxjs/operators";
import { DayOfWeek } from "@/models/section";
import TWEEN from "@tweenjs/tween.js";

const COLORS = [
  "#CDDC39",
  "#F44336",
  "#2196F3",
  "#FF9800",
  "#009688",
  "#795548"
];

export default {
  name: "calendar",
  components: { CourseName },
  props: {
    records: {
      type: Array,
      required: true
    },
    term: {
      type: String,
      required: true
    }
  },
  data() {
    const clock = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    return {
      topShift: 480,
      height: 600,
      times: [...clock.map(v => v + "a"), ...clock.map(v => v + "p")],
      DayOfWeek
    };
  },
  computed: {
    ...mapState("calendar", { temporary: state => state.temporary }),
    ...mapGetters("institution", ["institution"]),
    earliest() {
      if (this.schedules.length == 0) {
        return 360;
      }
      return (
        Math.floor(
          Math.min(...this.schedules.map(x => (x.schedule.end / 60) | 0)) / 30
        ) * 30
      );
    },
    latest() {
      if (this.schedules.length == 0) {
        return 1260;
      }
      return (
        Math.ceil(
          Math.max(...this.schedules.map(x => (x.schedule.end / 60) | 0)) / 30
        ) * 30
      );
    },
    legend() {
      return Object.values(
        this.schedules.reduce((a, b) => ({ ...a, [b.color]: b }), {})
      ).sort((a, b) => {
        if (a.course == b.course) {
          return a.section < b.section ? -1 : 1;
        }
        return a.course < b.course ? -1 : 1;
      });
    }
  },
  methods: {
    ...mapActions("filter", ["reset"]),
    overlaps(schedule, previous) {
      return schedule.day == previous.day && schedule.start < previous.end;
    },
    flattenToSchedules(section, activity) {
      function parseSchedule(activity) {
        return (activity.schedule || []).map(schedule => ({
          schedule,
          type: activity.type
        }));
      }
      const results = (section.primaries || [])
        .map(parseSchedule)
        .reduce((a, b) => a.concat(b), []);
      if (section.secondaries && activity && section.secondaries[activity]) {
        results.push(...parseSchedule(section.secondaries[activity]));
      }
      return results;
    },
    tween() {
      function animate() {
        if (TWEEN.update()) {
          requestAnimationFrame(animate);
        }
      }
      this.$nextTick(() => {
        const state = { topShift: this.topShift, height: this.height };
        const height = Math.max(600, this.latest - this.earliest + 120);
        const topShift =
          this.earliest - (height - this.latest + this.earliest) / 2;
        new TWEEN.Tween(state)
          .easing(TWEEN.Easing.Quadratic.Out)
          .to({ topShift, height }, 500)
          .onUpdate(() => {
            this.topShift = state.topShift;
            this.height = state.height;
          })
          .start();
        animate();
      });
    }
  },
  subscriptions() {
    const institution$ = this.$observe(() => this.institution);
    const scheduleHints = institution$.pipe(
      switchMap(institution => institution.data()),
      map(data => data.scheduleBlocks)
    );
    const schedules = combineLatest(
      this.$observe(() => this.records),
      this.$observe(() => this.term),
      this.$observe(() => this.temporary).pipe(
        map(temporary => {
          return (
            temporary.course && {
              ...temporary,
              color: "rgba(255, 235, 59, 0.8)",
              temporary: true
            }
          );
        })
      )
    ).pipe(
      debounceTime(50),
      switchMap(([records, term, temporary]) => {
        if (temporary) {
          records.push(temporary);
        }
        if (records.length == 0) {
          return of([]);
        }
        return combineLatest(
          // Get the course data for each transcript record.
          records.map(record => {
            return institution$.pipe(
              map(institution =>
                institution
                  .course(record.course)
                  .term(term)
                  .section(record.section)
              ),
              switchMap(section => section.data()),
              // Pull the schedules.
              map(schedule =>
                this.flattenToSchedules(schedule, record.activity)
              ),
              // Add the course id.
              map(schedule => schedule.map(s => ({ ...s, ...record })))
            );
          })
        ).pipe(
          // Flatten the array and assign a color.
          map(schedule => {
            return schedule.reduce((accumulator, value, index) => {
              return accumulator.concat(
                value.map(block => {
                  return {
                    ...block,
                    color: block.color || COLORS[index]
                  };
                })
              );
            }, []);
          }),
          // Sort by time desc.
          map(schedule =>
            schedule.sort((a, b) => a.schedule[0] - b.schedule[0])
          ),
          map(Object.freeze),
          tap(() => this.tween())
        );
      })
    );

    return { schedules, scheduleHints };
  }
};
</script>

<style scoped>
.block {
  cursor: pointer;
}

.legend-tile >>> .list__tile {
  height: 40px;
}
</style>
