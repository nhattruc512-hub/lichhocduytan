import { ClassFinder } from "@/components/class-finder";
import { demoClasses } from "@/lib/mock-classes";

export default function Home() {
  return <ClassFinder initialClasses={demoClasses} />;
}
