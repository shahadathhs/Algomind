// The starter campaign: three worlds, six chapters, twenty-eight levels, in play order.
// Source of truth for the seed. Boards are text rows: `.` floor, `#` wall, `G` target, and `^ > v <`
// for the automaton and its facing. The JSON below is read by scripts/level-lab/cli.mjs (check), so
// it stays plain JSON: prettier must not reformat it.
//
// Every limit is at least the shortest program (the seed checks this with the solver and fails
// loudly otherwise). Every level offers all the movement commands (Move, Left, Right), and world 3
// adds Repeat. World 1 and chapter "Budgets" allow exactly the shortest program; chapter "Detours"
// leaves a little slack. In world 3 every limit equals the loop par: the plain program is longer
// than the limit, so each level needs a loop (a test checks this).

// prettier-ignore
export const CAMPAIGN = {
  "worlds": [
    {
      "title": "Basics",
      "description": "Instructions run in order, one after another.",
      "chapters": [
        {
          "title": "Moves",
          "levels": [
            {
              "slug": "first-step",
              "title": "First step",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 2,
              "rows": [
                ".....",
                ".....",
                "..G..",
                ".....",
                "..^.."
              ],
              "hints": [
                "Tap Move twice, then Run."
              ]
            },
            {
              "slug": "count-the-cells",
              "title": "Count the cells",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 4,
              "rows": [
                ".....",
                ".....",
                ".....",
                ".....",
                ">...G"
              ],
              "hints": [
                "Count the cells between the automaton and the target."
              ]
            },
            {
              "slug": "beside-the-wall",
              "title": "Beside the wall",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 4,
              "rows": [
                ".....",
                ".###.",
                "G...<",
                ".###.",
                "....."
              ],
              "hints": [
                "The walls on both sides are not in your way. Keep moving."
              ]
            },
            {
              "slug": "long-run",
              "title": "Long run",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 6,
              "rows": [
                ".#G#.",
                ".#.#.",
                ".#.#.",
                ".#.#.",
                ".#.#.",
                ".#.#.",
                ".#^#."
              ],
              "hints": [
                "Six cells. Count before you add tiles."
              ]
            }
          ]
        },
        {
          "title": "Turns",
          "levels": [
            {
              "slug": "first-turn",
              "title": "First turn",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 7,
              "rows": [
                ".....",
                "...G.",
                ".....",
                ".....",
                "^...."
              ],
              "hints": [
                "A turn changes the direction Move goes in.",
                "Move up first, then turn right."
              ]
            },
            {
              "slug": "left-turn",
              "title": "Turn left",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 6,
              "rows": [
                ".....",
                ".....",
                ".G...",
                ".....",
                "....^"
              ],
              "hints": [
                "Turn left to face the other way.",
                "Move up to the target's row first."
              ]
            },
            {
              "slug": "turn-around",
              "title": "Turn around",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 5,
              "rows": [
                ".....",
                "..^..",
                ".....",
                ".....",
                "..G.."
              ],
              "hints": [
                "The target is behind you.",
                "Two turns make a half turn."
              ]
            },
            {
              "slug": "two-corners",
              "title": "Two corners",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 10,
              "rows": [
                "....G",
                "####.",
                ".....",
                ".####",
                "^...."
              ],
              "hints": [
                "Each wall has one gap, on the opposite side."
              ]
            }
          ]
        }
      ]
    },
    {
      "title": "Routes",
      "description": "Look at the whole board, then choose a route.",
      "chapters": [
        {
          "title": "Detours",
          "levels": [
            {
              "slug": "around-the-wall",
              "title": "Around the wall",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 13,
              "rows": [
                "......",
                "......",
                "...G..",
                "...###",
                "......",
                ".....^"
              ],
              "hints": [
                "Go around the wall. The way around is longer than it looks."
              ]
            },
            {
              "slug": "find-the-gap",
              "title": "Find the gap",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 14,
              "rows": [
                "......",
                "...G..",
                "...###",
                "......",
                "###...",
                "..^..."
              ],
              "hints": [
                "Look for the opening first, then plan how to reach it."
              ]
            },
            {
              "slug": "dead-end",
              "title": "Dead end",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 16,
              "rows": [
                ".......",
                "G#....#",
                ".#....#",
                ".#....#",
                "###...#",
                ".#....#",
                "....>.."
              ],
              "hints": [
                "One way looks open and leads nowhere. Check where it ends."
              ]
            },
            {
              "slug": "two-ways",
              "title": "Two ways",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 15,
              "rows": [
                "........",
                ".......#",
                "....G...",
                "........",
                "....####",
                "........",
                ".......#",
                ".......>"
              ],
              "hints": [
                "Two routes work. One needs fewer tiles."
              ]
            },
            {
              "slug": "the-long-wall",
              "title": "The long wall",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 18,
              "rows": [
                "......G.",
                "........",
                "........",
                "........",
                "...#####",
                "........",
                "........",
                "......<."
              ],
              "hints": [
                "The wall is long. Plan the whole route before you add tiles."
              ]
            }
          ]
        },
        {
          "title": "Budgets",
          "levels": [
            {
              "slug": "no-spare-tiles",
              "title": "No spare tiles",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 11,
              "rows": [
                "......",
                "...G.#",
                "......",
                "..####",
                "......",
                "..>..."
              ],
              "hints": [
                "The limit is exactly enough. Every tile counts."
              ]
            },
            {
              "slug": "fewer-turns",
              "title": "Fewer turns",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 12,
              "rows": [
                ".......",
                "...G...",
                ".......",
                "####...",
                ".......",
                ".#..##.",
                ".#..>.."
              ],
              "hints": [
                "Fewer cells is not always fewer tiles. Turns count as tiles."
              ]
            },
            {
              "slug": "count-the-turns",
              "title": "Count the turns",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 14,
              "rows": [
                "...G..",
                ".####.",
                "......",
                "......",
                ".....#",
                ".....^"
              ],
              "hints": [
                "Count the turns as well as the moves."
              ]
            },
            {
              "slug": "one-route",
              "title": "One route",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 16,
              "rows": [
                "........",
                ".....###",
                "...G....",
                "........",
                ".#......",
                "#######.",
                ".#......",
                ".#>....."
              ],
              "hints": [
                "There is only one route. Find it, then count."
              ]
            },
            {
              "slug": "gauntlet",
              "title": "Gauntlet",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT"
              ],
              "maxCommands": 19,
              "rows": [
                "........",
                "#.#.....",
                "#.#....G",
                "#.#.....",
                "#.######",
                "#.#.....",
                "..#####.",
                ">.....#."
              ],
              "hints": [
                "Work backward from the target."
              ]
            }
          ]
        }
      ]
    },
    {
      "title": "Loops",
      "description": "Say a pattern once and repeat it.",
      "chapters": [
        {
          "title": "Repeat",
          "levels": [
            {
              "slug": "say-it-once",
              "title": "Say it once",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 2,
              "rows": [
                ".....",
                "..G..",
                ".....",
                ".....",
                ".....",
                ".....",
                ".....",
                ".....",
                "..^.."
              ],
              "hints": [
                "Repeat runs the tiles inside it again and again.",
                "Put Move inside the loop, then set the rounds with plus and minus."
              ]
            },
            {
              "slug": "run-turn-run",
              "title": "Run, turn, run",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 5,
              "rows": [
                ".......",
                ".....G.",
                ".......",
                ".......",
                ".......",
                ".......",
                "^......"
              ],
              "hints": [
                "A loop can sit between other tiles.",
                "Tap End loop to go back to adding single tiles."
              ]
            },
            {
              "slug": "stairs",
              "title": "Stairs",
              "difficulty": "easy",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 5,
              "rows": [
                "#####G",
                "####..",
                "###..#",
                "##..##",
                "#..###",
                ">.####"
              ],
              "hints": [
                "Look for the part that repeats over and over."
              ]
            },
            {
              "slug": "wide-steps",
              "title": "Wide steps",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 6,
              "rows": [
                ">.###",
                "#.###",
                "#..##",
                "##.##",
                "##..#",
                "###.#",
                "###..",
                "####.",
                "####G"
              ],
              "hints": [
                "The pattern is longer now. Find where it starts again."
              ]
            }
          ]
        },
        {
          "title": "Patterns",
          "levels": [
            {
              "slug": "sideways-steps",
              "title": "Sideways steps",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 6,
              "rows": [
                "######v",
                "####...",
                "##...##",
                "G..####"
              ],
              "hints": [
                "Follow the corridor and find the part that repeats."
              ]
            },
            {
              "slug": "grand-staircase",
              "title": "Grand staircase",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 7,
              "rows": [
                "##########v",
                "##########.",
                "########...",
                "########.##",
                "######...##",
                "######.####",
                "####...####",
                "####.######",
                "##...######",
                "##.########",
                "G..########"
              ],
              "hints": [
                "A big board and a small pattern. Count the rounds."
              ]
            },
            {
              "slug": "run-and-climb",
              "title": "Run and climb",
              "difficulty": "medium",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 9,
              "rows": [
                "####v",
                "####.",
                "####.",
                "###..",
                "##..#",
                "#..##",
                "..###",
                ".####",
                ".####",
                ".####",
                "G####"
              ],
              "hints": [
                "Some moves come before the pattern. Add them before or after the loop."
              ]
            },
            {
              "slug": "climb-and-run",
              "title": "Climb and run",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 10,
              "rows": [
                "v#########",
                ".#########",
                ".#########",
                "...#######",
                "##.#######",
                "##...#####",
                "####.#####",
                "####...###",
                "######.###",
                "######...G"
              ],
              "hints": [
                "A loop needs only one pass of the pattern. The rounds do the rest."
              ]
            },
            {
              "slug": "long-way-up",
              "title": "Long way up",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 10,
              "rows": [
                "######G",
                "######.",
                "######.",
                "####...",
                "####.##",
                "##...##",
                "##.####",
                "...####",
                ".######",
                ".######",
                ".######",
                "^######"
              ],
              "hints": [
                "Work out the pattern first, then count how many times it repeats."
              ]
            },
            {
              "slug": "final-climb",
              "title": "Final climb",
              "difficulty": "hard",
              "commands": [
                "MOVE_FORWARD",
                "TURN_LEFT",
                "TURN_RIGHT",
                "REPEAT"
              ],
              "maxCommands": 12,
              "rows": [
                "###>...",
                "######.",
                "####...",
                "####.##",
                "##...##",
                "##.####",
                "...####",
                ".######",
                ".######",
                "G######"
              ],
              "hints": [
                "Find the pattern, the rounds, and what comes after."
              ]
            }
          ]
        }
      ]
    }
  ]
} as const;
