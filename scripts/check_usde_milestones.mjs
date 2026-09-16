// Read-only collector for the owner-managed headless notification job.
import { fetchUsdeObservation } from '../js/usde-observation.js';
try {
  console.log(JSON.stringify(await fetchUsdeObservation()));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
