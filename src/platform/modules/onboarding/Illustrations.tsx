import { useId } from 'react';

// Adapted from StudioOwnership and StudioFoundation in the creator's marketing site.
// Use Studio theme colors and human labels; these sketches introduce concepts, not file formats.
const paper = 'var(--background)';
const ink = 'var(--foreground)';
const muted = 'var(--muted-foreground)';
const border = 'var(--border)';

export function AgentSketch() {
  const id = useId();
  return (
    <svg
      viewBox='0 0 440 210'
      className='h-44 w-full text-foreground'
      role='img'
      aria-label='Describe your idea to your coding agent, then try and refine the result in Design Studio.'
    >
      <defs>
        <pattern id={id} width='16' height='16' patternUnits='userSpaceOnUse'>
          <path d='M16 0H0V16' fill='none' stroke='currentColor' opacity='.07' />
        </pattern>
      </defs>
      <rect x='8' y='8' width='424' height='194' fill={`url(#${id})`} />
      <g transform='rotate(-3 126 102)'>
        <rect x='32' y='32' width='200' height='134' rx='5' fill={paper} stroke={border} />
        <path d='M32 58H232' stroke={border} />
        <text x='47' y='49' fontSize='12' fill={muted}>
          Your coding agent
        </text>
        <text x='47' y='86' fontSize='12' fill={ink}>
          Let’s explore an idea.
        </text>
        <path d='M47 104H177M47 115H206M47 126H164' stroke='currentColor' opacity='.2' />
        <rect x='47' y='138' width='56' height='14' rx='3' fill='currentColor' opacity='.08' />
      </g>
      <g transform='rotate(3 302 135)'>
        <rect x='209' y='72' width='199' height='118' rx='5' fill={paper} stroke={border} />
        <path d='M209 98H408' stroke={border} />
        <text x='223' y='89' fontSize='12' fill={muted}>
          Design Studio
        </text>
        <rect x='223' y='111' width='44' height='62' rx='3' fill='currentColor' opacity='.07' />
        <path d='M279 116H393M279 131H367M279 155H393M279 170H352' stroke='currentColor' opacity='.3' />
        <path d='M355 130V148L360 143L365 151L369 149L364 141H372Z' fill={ink} />
      </g>
    </svg>
  );
}

export function SystemSketch({ selected }: { selected: number }) {
  return <StorySketch kind={['toolkit', 'context', 'skills'][selected]} />;
}

export function ArtifactSketch({ kind }: { kind: string }) {
  return (
    <svg
      viewBox='0 0 440 150'
      className='h-32 w-full text-foreground'
      role='img'
      aria-label={
        kind === 'view'
          ? 'An inbox screen with messages to explore.'
          : kind === 'document'
            ? 'A brief explaining the problem and audience.'
            : kind === 'diagrams'
              ? 'A flow from receiving a message to reviewing and resolving it.'
              : 'Screens, a brief, and a flow arranged together on a canvas.'
      }
    >
      {kind === 'view' && (
        <>
          <rect x='63' y='9' width='314' height='132' rx='4' fill={paper} stroke={border} />
          <path d='M63 35H377M126 35V141' stroke={border} />
          <text x='77' y='27' fontSize='11' fill={muted}>
            Feedback inbox
          </text>
          <path d='M76 51H111M76 63H101M76 75H105' stroke='currentColor' opacity='.25' />
          <rect x='140' y='47' width='61' height='16' rx='3' fill='currentColor' opacity='.08' />
          <path d='M140 77H360M140 98H360M140 119H360' stroke={border} />
          <path d='M144 87H231M144 108H259M144 129H218' stroke='currentColor' opacity='.4' />
          <rect x='326' y='83' width='28' height='7' rx='2' fill='currentColor' opacity='.15' />
          <circle cx='343' cy='87' r='14' fill='none' stroke={ink} strokeDasharray='3 3' />
          <path d='M349 98V115L354 110L358 117L362 115L357 108H365Z' fill={ink} />
        </>
      )}
      {kind === 'document' && (
        <>
          <rect x='102' y='8' width='236' height='135' rx='4' fill={paper} stroke={border} />
          <text x='121' y='33' fontSize='13' fill={ink}>
            The idea we’re exploring
          </text>
          <text x='121' y='58' fontSize='10' fill={muted}>
            The problem
          </text>
          <path d='M121 69H317M121 78H299M121 87H307' stroke='currentColor' opacity='.25' />
          <text x='121' y='109' fontSize='10' fill={muted}>
            Who it’s for
          </text>
          <path d='M121 120H311M121 129H279' stroke='currentColor' opacity='.25' />
        </>
      )}
      {kind === 'diagrams' && (
        <>
          <g fill={paper} stroke={border}>
            <rect x='22' y='54' width='100' height='43' rx='4' />
            <path d='M178 75L220 33L262 75L220 117Z' />
            <rect x='317' y='54' width='101' height='43' rx='4' />
          </g>
          <path d='M122 75H178M262 75H317' stroke='currentColor' opacity='.4' />
          <g fontSize='12' fill={ink} textAnchor='middle'>
            <text x='72' y='80'>
              Receive
            </text>
            <text x='220' y='80'>
              Review
            </text>
            <text x='367' y='80'>
              Resolve
            </text>
          </g>
        </>
      )}
      {kind === 'canvas' && (
        <>
          <g fill={paper} stroke={border}>
            <rect x='35' y='20' width='122' height='87' rx='3' transform='rotate(-3 96 63)' />
            <rect x='186' y='9' width='103' height='71' rx='3' transform='rotate(2 237 44)' />
            <rect x='177' y='96' width='180' height='44' rx='3' />
            <rect x='318' y='31' width='82' height='52' rx='3' />
          </g>
          <g fontSize='11' fill={muted}>
            <text x='48' y='39'>
              A screen
            </text>
            <text x='199' y='28'>
              The brief
            </text>
            <text x='329' y='50'>
              A note
            </text>
          </g>
          <path
            d='M49 54H141M49 66H132M49 78H139M200 42H271M200 52H262M200 62H267'
            stroke='currentColor'
            opacity='.25'
          />
          <g stroke='currentColor' fill='none' opacity='.35'>
            <rect x='190' y='109' width='38' height='17' rx='2' />
            <path d='M228 118H243L257 104L271 118L257 132L243 118M271 118H299' />
            <rect x='299' y='109' width='44' height='17' rx='2' />
          </g>
        </>
      )}
    </svg>
  );
}

const storyLabels: Record<string, string> = {
  toolkit: 'Components and a theme become a screen that fits your product.',
  context: 'Product knowledge guides a design decision for your audience.',
  skills: 'A design critique skill is invoked with a slash command in the agent chat.',
  brief: 'A Markdown brief stays inside the prototype as lasting context.',
  'brief-chat': 'Discuss the problem, audience, and learning goal with your agent.',
  lofi: 'A simple wireframe shows layout and navigation without visual detail.',
  publish: 'A local prototype becomes a viewing site with a web address.',
  share: 'A shared site link opens a read-only viewer of prototypes and artifacts.',
  source: 'Two teammates work from the same repository of code and context.',
  modules: 'A canvas module adds a capability to the existing studio.',
  explore: 'Curated prototype examples ready to explore.',
};
function Screen({ x, y, label, width = 150 }: { x: number; y: number; label: string; width?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height='104' rx='5' fill={paper} stroke={border} />
      <path d={`M${x} ${y + 25}h${width}`} stroke={border} />
      <text x={x + 12} y={y + 17} fontSize='11' fill={muted}>
        {label}
      </text>
      <rect x={x + 12} y={y + 37} width='28' height='52' rx='3' fill={ink} opacity='.07' />
      <path
        d={`M${x + 52} ${y + 43}h${width - 65}M${x + 52} ${y + 61}h${width - 78}M${x + 52} ${y + 80}h${width - 70}`}
        stroke={ink}
        opacity='.25'
      />
    </g>
  );
}
function Arrow({ x, y, length = 48 }: { x: number; y: number; length?: number }) {
  return <path d={`M${x} ${y}h${length}m-7 -5l7 5l-7 5`} stroke={muted} fill='none' />;
}
export function StorySketch({ kind, exampleIds }: { kind: string; exampleIds?: string[] }) {
  const showProduct = exampleIds?.includes('echo-app') ?? true;
  const showMarketing = exampleIds?.includes('echo-website') ?? true;
  return (
    <svg viewBox='0 0 440 180' className='h-40 w-full text-foreground' role='img' aria-label={storyLabels[kind]}>
      {kind === 'toolkit' && (
        <>
          <rect x='24' y='24' width='158' height='132' rx='5' fill={paper} stroke={border} />
          <text x='38' y='46' fill={muted} fontSize='12'>
            Your toolkit
          </text>
          {[0, 1, 2].map(i => (
            <circle key={i} cx={48 + i * 30} cy='69' r='9' fill={ink} opacity={0.15 + i * 0.25} />
          ))}
          <rect x='38' y='92' width='64' height='21' rx='5' fill={ink} />
          <text x='49' y='107' fontSize='10' fill={paper}>
            Button
          </text>
          <rect x='38' y='124' width='126' height='18' rx='3' fill={paper} stroke={border} />
          <Arrow x={194} y={90} length={38} />
          <Screen x={249} y={38} label='Your product' width={166} />
        </>
      )}
      {kind === 'context' && (
        <>
          <rect x='25' y='29' width='166' height='122' rx='4' fill={paper} stroke={border} />
          <text x='40' y='53' fontSize='12' fill={ink}>
            Who we’re designing for
          </text>
          <circle cx='53' cy='80' r='11' fill={ink} opacity='.1' />
          <path d='M76 76H173M76 88H147M40 112H174M40 127H156' stroke={ink} opacity='.25' />
          <Arrow x={204} y={89} length={30} />
          <Screen x={250} y={38} label='A choice that fits' width={165} />
          <circle cx='365' cy='118' r='15' fill={paper} stroke={ink} />
          <path d='M358 118l5 5l9-11' stroke={ink} fill='none' />
        </>
      )}
      {kind === 'skills' && (
        <>
          <rect x='28' y='35' width='166' height='110' rx='5' fill={paper} stroke={border} />
          <text x='43' y='58' fontSize='12' fill={ink}>
            Design critique skill
          </text>
          <text x='43' y='85' fontSize='11' fill={muted}>
            Run a design critique
          </text>
          <path d='M43 104H174M43 118H149' stroke={ink} opacity='.25' />
          <Arrow x={207} y={89} length={30} />
          <rect x='250' y='43' width='162' height='94' rx='5' fill={paper} stroke={border} />
          <text x='266' y='65' fontSize='12' fill={ink}>
            Your agent
          </text>
          <rect x='260' y='77' width='142' height='24' rx='4' fill={paper} stroke={border} />
          <text x='266' y='93' fontSize='10' fontFamily='monospace' fill={ink}>
            /design-critique
          </text>
          <text x='266' y='121' fontSize='10' fill={muted}>
            Running design critique
          </text>
        </>
      )}
      {(kind === 'brief' || kind === 'brief-chat') && (
        <>
          <rect x='24' y='15' width='183' height='150' rx='4' fill={paper} stroke={border} />
          <text x='40' y='35' fontSize='12' fill={ink}>
            {kind === 'brief' ? 'brief.md' : 'Your brief'}
          </text>
          {['The problem', 'Who it’s for', 'What we want to learn'].map((label, i) => (
            <g key={label}>
              <text x='40' y={61 + i * 34} fontSize='10' fill={muted}>
                {label}
              </text>
              <path d={`M40 ${72 + i * 34}h146`} stroke={ink} opacity='.25' />
            </g>
          ))}
          <Arrow x={219} y={91} length={23} />
          <Screen x={257} y={38} label={kind === 'brief' ? 'Your prototype' : 'First concept'} width={157} />
          {kind === 'brief' && (
            <>
              <rect x='303' y='107' width='98' height='24' rx='3' fill={paper} stroke={border} />
              <text x='315' y='123' fontSize='11' fill={ink}>
                brief.md
              </text>
            </>
          )}
        </>
      )}
      {kind === 'lofi' && (
        <>
          <rect x='72' y='15' width='296' height='150' rx='3' fill={paper} stroke={border} />
          <path d='M72 44H368M133 44V165' stroke={border} />
          <path d='M87 60H116M87 75H108M87 90H119' stroke={ink} opacity='.3' />
          <rect x='149' y='59' width='200' height='42' fill='none' stroke={muted} strokeDasharray='4 4' />
          <path d='M149 59L349 101M349 59L149 101M149 118H349M149 133H310' stroke={muted} opacity='.5' />
          <rect x='149' y='145' width='52' height='9' fill='none' stroke={border} />
        </>
      )}
      {kind === 'publish' && (
        <>
          <Screen x={22} y={39} label='Local prototype' width={151} />
          <Arrow x={187} y={92} length={43} />
          <Screen x={247} y={39} label='prototype.example' width={169} />
          <circle cx='392' cy='24' r='15' fill={paper} stroke={muted} />
          <ellipse cx='392' cy='24' rx='7' ry='15' fill='none' stroke={muted} />
          <path d='M377 24H407' stroke={muted} />
        </>
      )}
      {kind === 'share' && (
        <>
          <rect x='22' y='56' width='169' height='66' rx='5' fill={paper} stroke={border} />
          <text x='38' y='79' fontSize='12' fill={ink}>
            Your published site
          </text>
          <path d='M38 100H171' stroke={ink} opacity='.3' />
          <Arrow x={204} y={88} length={28} />
          <Screen x={249} y={26} label='Read-only viewer' width={164} />
          <rect x='283' y='139' width='132' height='29' rx='6' fill={paper} stroke={border} />
          <text x='294' y='157' fontSize='11' fill={muted}>
            “Let’s try this idea.”
          </text>
        </>
      )}
      {kind === 'source' && (
        <>
          <rect x='158' y='27' width='124' height='123' rx='5' fill={paper} stroke={border} />
          <text x='174' y='51' fontSize='12' fill={ink}>
            Shared source
          </text>
          {['Code', 'Context', 'Assets'].map((label, i) => (
            <text key={label} x='176' y={79 + i * 24} fontSize='11' fill={muted}>
              {label}
            </text>
          ))}
          {[71, 369].map(x => (
            <g key={x}>
              <circle cx={x} cy='69' r='15' fill={paper} stroke={muted} />
              <path d={`M${x - 23} 113v-6a23 23 0 0146 0v6`} fill='none' stroke={muted} />
            </g>
          ))}
          <path d='M97 90H158M282 90H343' stroke={muted} strokeDasharray='4 3' />
        </>
      )}
      {kind === 'modules' && (
        <>
          <Screen x={24} y={39} label='Your studio' width={168} />
          <path d='M207 89H239M223 73V105' stroke={muted} />
          <rect x='255' y='27' width='161' height='126' rx='5' fill={paper} stroke={border} />
          <text x='270' y='49' fontSize='12' fill={ink}>
            Canvas module
          </text>
          <g fill='none' stroke={muted}>
            <rect x='271' y='65' width='44' height='36' rx='3' />
            <rect x='347' y='98' width='51' height='36' rx='3' />
            <path d='M315 84H329V115H347' />
          </g>
        </>
      )}
      {kind === 'explore' && (
        <>
          {showProduct && (
            <g transform={showMarketing ? 'rotate(-3 118 94)' : 'translate(100 0)'}>
              <rect x='20' y='27' width='195' height='137' rx='5' fill={paper} stroke={border} />
              <path d='M20 53H215M62 53V164' stroke={border} />
              <text x='33' y='44' fontSize='13' fill={muted}>
                Product example
              </text>
              <path d='M32 69H50M32 82H45M32 95H49' stroke={ink} opacity='.25' />
              <text x='74' y='72' fontSize='11' fill={ink}>
                Echo app
              </text>
              {[0, 1, 2].map(row => (
                <g key={row}>
                  <rect
                    x='73'
                    y={83 + row * 23}
                    width='130'
                    height='20'
                    rx='3'
                    fill={row === 0 ? ink : paper}
                    fillOpacity={row === 0 ? 0.07 : 1}
                    stroke={border}
                  />
                  <circle cx='84' cy={93 + row * 23} r='3' fill={ink} opacity='.25' />
                  <path
                    d={`M94 ${90 + row * 23}h${row === 1 ? 75 : 57}M94 ${96 + row * 23}h${row === 2 ? 53 : 88}`}
                    stroke={ink}
                    opacity='.3'
                  />
                </g>
              ))}
            </g>
          )}
          {showMarketing && (
            <g transform={showProduct ? 'rotate(3 320 91)' : 'translate(-100 0)'}>
              <rect x='235' y='16' width='185' height='146' rx='5' fill={paper} stroke={border} />
              <path d='M235 42H420' stroke={border} />
              <text x='248' y='33' fontSize='13' fill={muted}>
                Marketing example
              </text>
              <text x='249' y='66' fontSize='13' fill={ink}>
                Hear every
              </text>
              <text x='249' y='83' fontSize='13' fill={ink}>
                customer.
              </text>
              <path d='M249 96H394M249 104H359' stroke={ink} opacity='.25' />
              <rect x='249' y='118' width='58' height='19' rx='4' fill={ink} />
              <text x='278' y='127.5' textAnchor='middle' dominantBaseline='middle' fontSize='9' fill={paper}>
                Start free
              </text>
              <rect x='320' y='116' width='85' height='31' rx='3' fill={paper} stroke={border} />
              <path d='M331 126H393M331 137H370' stroke={ink} opacity='.2' />
            </g>
          )}
          {showProduct && (
            <path
              transform={showMarketing ? undefined : 'translate(100 0)'}
              d='M183 111V134L189 128L195 140L200 137L194 126H206Z'
              fill={ink}
            />
          )}
        </>
      )}
    </svg>
  );
}

export function ScopeDiagram() {
  return (
    <div
      role='img'
      aria-label='Nested editing scopes: New contributors start with their own prototypes by default. System maintainers also edit assigned systems. Admins can edit the whole Studio.'
      className='mx-auto w-full max-w-[26rem] py-2'
    >
      <div className='rounded border border-border bg-background p-3'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm leading-5'>
          <span>Admin</span>
          <span className='text-muted-foreground'>The whole Studio</span>
        </div>
        <div className='mt-2 rounded border border-border p-3'>
          <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm leading-5'>
            <span>System maintainer</span>
            <span className='text-muted-foreground'>Assigned systems</span>
          </div>
          <div className='mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded border border-border px-3 py-2 text-sm leading-5'>
            <span>Contributor (default)</span>
            <span className='text-muted-foreground'>Your prototypes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
