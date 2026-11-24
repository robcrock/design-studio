/** @studio-id 1hz1pr0jff6c71bh */
import { useDialKit } from '@module/dialkit';
import { EchoHome } from './_components/site';

// Echo's homepage with a cobalt hero, the brand at full strength. An example of DialKit: the headline size and how far
// the product shot hangs below the hero are dials. Tune them in the panel, then save them to code to keep them.
export default function Home() {
  const hero = useDialKit('Hero', {
    titleSize: [76, 48, 104, 2],
    shotOverlap: [160, 0, 320, 8],
  });
  return <EchoHome tone="cobalt" hero={hero} />;
}
