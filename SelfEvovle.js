/**
 * EvoCore.js – Self‑Evolving Website Framework for DarkGameStudio
 * 
 * The framework treats the website as a population of "genomes".
 * Each genome is a set of CSS variables, text snippets, and layout flags.
 * Through a Genetic Algorithm, it periodically breeds, mutates, and selects
 * the best performing version based on real‑time user interaction scores.
 *
 * Drop it in, and the site evolves itself.
 */

class EvoCore {
  constructor(options = {}) {
    // --- Tunable evolution parameters ---
    this.populationSize = options.populationSize || 10;
    this.mutationRate = options.mutationRate || 0.15;
    this.crossoverRate = options.crossoverRate || 0.7;
    this.elitismCount = options.elitismCount || 2;
    this.generationInterval = options.generationInterval || 30; // minutes
    this.engagementWeight = options.engagementWeight || 0.6;
    this.bounceWeight = options.bounceWeight || 0.4;

    // --- Population store (uses localStorage) ---
    this.storageKey = 'dg_evo_population';
    this.population = this.loadPopulation() || this.seedPopulation();

    // --- Active genome index (currently applied) ---
    this.activeIndex = 0;
    this.currentGenome = this.population[0];
    this.generation = 0;

    // --- Interaction metrics ---
    this.sessionStart = Date.now();
    this.clicks = 0;
    this.scrollDepth = 0;
    this.maxScroll = 0;
    this.hasConverted = false;

    // --- Bind event listeners ---
    this.bindEvents();

    // --- Apply initial genome ---
    this.applyGenome(this.currentGenome);

    // --- Start evolution loop ---
    this.scheduleEvolution();

    console.log('🖤 EvoCore initialized – Generation', this.generation);
  }

  /* ------------- Genome definition ------------- */
  // Each genome is a plain object with properties the site can use.
  seedPopulation() {
    const seed = [];
    for (let i = 0; i < this.populationSize; i++) {
      seed.push(this.randomGenome());
    }
    return seed;
  }

  randomGenome() {
    return {
      // CSS variable overrides
      '--bg-deep': this.randomHex(),
      '--bg-card': this.randomHex(),
      '--accent': this.randomHex(),
      '--accent-glow': this.randomHex(),
      '--text': this.randomHex(),
      '--text-light': this.randomHex(),
      // Text mutations (headline / subtitle snippets)
      headline: this.randomHeadline(),
      subtitle: this.randomSubtitle(),
      // Layout flags
      cardCount: Math.floor(Math.random() * 5) + 3, // 3-7 game cards
      showTeam: Math.random() > 0.3,
      // Particle density
      particleCount: Math.floor(Math.random() * 50) + 30,
    };
  }

  randomHex() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    // Prefer dark colors – keep luminance low
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 8)];
    }
    return color;
  }

  randomHeadline() {
    const lines = [
      'We Craft Dark Immersive Worlds',
      'Embrace the Abyss',
      'Where Shadows Play',
      'Beyond the Veil of Reality',
      'Darkness Redefined',
      'Your Nightmare, Our Canvas',
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  randomSubtitle() {
    const subtitles = [
      'Atmospheric journeys into the void.',
      'Every pixel breathes darkness.',
      'Independent. Fearless. Eternal.',
      'Step into your darkest desire.',
      'Designed to haunt your dreams.',
    ];
    return subtitles[Math.floor(Math.random() * subtitles.length)];
  }

  /* ------------- Apply a genome to the DOM ------------- */
  applyGenome(genome) {
    const root = document.documentElement;
    // Set CSS variables
    for (const [prop, val] of Object.entries(genome)) {
      if (prop.startsWith('--')) {
        root.style.setProperty(prop, val);
      }
    }

    // Update hero headline (first h1 in hero-content)
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle && genome.headline) {
      heroTitle.innerHTML = genome.headline.includes('Dark') 
        ? genome.headline.replace('Dark', '<span class="accent">Dark</span>')
        : genome.headline;
    }

    // Update subtitle
    const heroSub = document.querySelector('.hero-subtitle');
    if (heroSub && genome.subtitle) {
      heroSub.textContent = genome.subtitle;
    }

    // Adjust game cards count (simulate by showing/hiding)
    const grid = document.querySelector('.games-grid');
    if (grid) {
      const cards = grid.querySelectorAll('.game-card');
      cards.forEach((card, i) => {
        card.style.display = i < genome.cardCount ? '' : 'none';
      });
    }

    // Team section visibility
    const teamSection = document.getElementById('team');
    if (teamSection) {
      teamSection.style.display = genome.showTeam ? '' : 'none';
    }

    // Particle count (set a CSS variable that the particle script reads)
    root.style.setProperty('--particle-count', genome.particleCount);
    // If we had a particle manager, we'd update it here
    window.dispatchEvent(new CustomEvent('evocore:genome-applied', { detail: genome }));
  }

  /* ------------- Fitness calculation ------------- */
  // Runs when the user leaves the page or at the end of a generation.
  calculateFitness() {
    const sessionDuration = (Date.now() - this.sessionStart) / 1000; // seconds
    const engagementScore = Math.min(sessionDuration / 120, 1) * this.engagementWeight;
    const bouncePenalty = (this.clicks === 0 && sessionDuration < 10) ? this.bounceWeight : 0;
    const scrollScore = Math.min(this.maxScroll / document.body.scrollHeight, 1) * 0.3;
    const conversionBonus = this.hasConverted ? 0.5 : 0;

    return engagementScore + scrollScore + conversionBonus - bouncePenalty;
  }

  /* ------------- Genetic operations ------------- */
  /**
   * Evolve the population:
   * 1. Evaluate fitness of all genomes.
   * 2. Keep elitists.
   * 3. Fill rest via crossover & mutation.
   */
  evolve() {
    // Assign fitness to current population (if we have stored fitness)
    const scored = this.population.map((genome, i) => {
      // Fitness is stored from last session; we use 0.5 as baseline if unknown
      const fit = genome._fitness || 0.5;
      return { genome, fitness: fit };
    });

    // Sort by fitness descending
    scored.sort((a, b) => b.fitness - a.fitness);

    const newPopulation = [];

    // Elitism: carry forward best genomes
    for (let i = 0; i < this.elitismCount; i++) {
      const elite = { ...scored[i].genome };
      elite._fitness = undefined; // will be re-evaluated
      newPopulation.push(elite);
    }

    // Breed the rest
    while (newPopulation.length < this.populationSize) {
      const parentA = this.selectParent(scored);
      const parentB = this.selectParent(scored);

      let child;
      if (Math.random() < this.crossoverRate) {
        child = this.crossover(parentA, parentB);
      } else {
        child = { ...parentA };
      }

      // Mutation
      child = this.mutate(child);

      newPopulation.push(child);
    }

    this.population = newPopulation;
    this.generation++;
    this.savePopulation();
    console.log(`🧬 Generation ${this.generation} evolved.`);
  }

  selectParent(scored) {
    // Tournament selection (size 3)
    const tournamentSize = 3;
    let best = null;
    for (let i = 0; i < tournamentSize; i++) {
      const candidate = scored[Math.floor(Math.random() * scored.length)];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    return best.genome;
  }

  crossover(parentA, parentB) {
    const child = {};
    const keys = Object.keys(parentA);
    keys.forEach(key => {
      if (key === '_fitness') return;
      // Randomly inherit from either parent
      child[key] = Math.random() < 0.5 ? parentA[key] : parentB[key];
    });
    return child;
  }

  mutate(genome) {
    const mutated = { ...genome };
    if (Math.random() < this.mutationRate) {
      // Mutate a random CSS variable
      const cssKeys = ['--bg-deep', '--bg-card', '--accent', '--accent-glow', '--text', '--text-light'];
      const randomKey = cssKeys[Math.floor(Math.random() * cssKeys.length)];
      mutated[randomKey] = this.randomHex();
    }
    if (Math.random() < this.mutationRate) {
      mutated.headline = this.randomHeadline();
    }
    if (Math.random() < this.mutationRate) {
      mutated.subtitle = this.randomSubtitle();
    }
    if (Math.random() < this.mutationRate) {
      mutated.cardCount = Math.floor(Math.random() * 5) + 3;
    }
    if (Math.random() < this.mutationRate) {
      mutated.showTeam = !mutated.showTeam;
    }
    if (Math.random() < this.mutationRate) {
      mutated.particleCount = Math.max(10, mutated.particleCount + (Math.random() > 0.5 ? 5 : -5));
    }
    return mutated;
  }

  /* ------------- Persistence ------------- */
  loadPopulation() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  savePopulation() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.population));
  }

  /* ------------- Event tracking ------------- */
  bindEvents() {
    // Clicks anywhere
    document.addEventListener('click', () => {
      this.clicks++;
      // Detect conversion: click on CTA
      if (event.target.matches('.btn-primary, .nav-cta')) {
        this.hasConverted = true;
      }
    });

    // Scroll depth
    window.addEventListener('scroll', () => {
      this.maxScroll = Math.max(this.maxScroll, window.scrollY + window.innerHeight);
    });

    // When user leaves, store fitness for current active genome
    window.addEventListener('beforeunload', () => {
      this.currentGenome._fitness = (this.currentGenome._fitness || 0.5) * 0.7 + this.calculateFitness() * 0.3;
      this.savePopulation();
    });
  }

  /* ------------- Evolution scheduling ------------- */
  scheduleEvolution() {
    // Evolve on page load if enough time has passed
    const lastEvo = localStorage.getItem('dg_evo_last');
    const now = Date.now();
    if (lastEvo && (now - parseInt(lastEvo)) > this.generationInterval * 60000) {
      this.evolve();
      // Switch to the best genome (first elitist)
      this.activeIndex = 0;
      this.currentGenome = this.population[0];
      this.applyGenome(this.currentGenome);
      localStorage.setItem('dg_evo_last', now);
    } else if (!lastEvo) {
      localStorage.setItem('dg_evo_last', now);
    }

    // Also evolve after session end (handled in beforeunload recursively)
    // For simplicity, we also set a timer to evolve while page is open (optional)
    setInterval(() => {
      // Silent background evaluation – can be expanded
    }, 60000);
  }

  /**
   * Manual override: force a generation now.
   */
  forceEvolve() {
    this.currentGenome._fitness = this.calculateFitness();
    this.savePopulation();
    this.evolve();
    this.activeIndex = 0;
    this.currentGenome = this.population[0];
    this.applyGenome(this.currentGenome);
    localStorage.setItem('dg_evo_last', Date.now());
  }
}

// ---- Initialize on load ----
window.addEventListener('DOMContentLoaded', () => {
  window.evo = new EvoCore({
    populationSize: 8,
    generationInterval: 15, // evolve every 15 minutes (for demo)
  });

  // Expose a debug command in console
  console.log('🦴 EvoCore ready. Type `evo.forceEvolve()` to trigger immediate evolution.');
});