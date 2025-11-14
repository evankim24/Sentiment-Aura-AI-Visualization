import React, { useRef, useEffect } from 'react';
import p5 from 'p5';

const PerlinAura = ({ sentiment, sentimentScore, emotions }) => {
  const canvasRef = useRef(null);
  const p5InstanceRef = useRef(null);

  useEffect(() => {
    // Create p5 instance
    const sketch = (p) => {
      // Animation state
      let particles = [];
      let flowField = [];
      let cols, rows;
      let scale = 20;
      let zoff = 0;
      
      // Current visual parameters (smoothly interpolated)
      let currentHue = 200;
      let targetHue = 200;
      let currentSaturation = 50;
      let targetSaturation = 50;
      let currentSpeed = 0.005;
      let targetSpeed = 0.005;
      let currentIntensity = 1;
      let targetIntensity = 1;

      // Particle class for the flow field
      class Particle {
        constructor() {
          this.pos = p.createVector(p.random(p.width), p.random(p.height));
          this.vel = p.createVector(0, 0);
          this.acc = p.createVector(0, 0);
          this.maxSpeed = 2;
          this.prevPos = this.pos.copy();
          this.alpha = p.random(50, 150);
        }

        update() {
          this.vel.add(this.acc);
          this.vel.limit(this.maxSpeed * currentIntensity);
          this.pos.add(this.vel);
          this.acc.mult(0);
        }

        follow(vectors) {
          let x = p.floor(this.pos.x / scale);
          let y = p.floor(this.pos.y / scale);
          let index = x + y * cols;
          let force = vectors[index];
          if (force) {
            this.applyForce(force);
          }
        }

        applyForce(force) {
          this.acc.add(force);
        }

        show() {
          p.stroke(currentHue, currentSaturation, 80, this.alpha);
          p.strokeWeight(1.5);
          p.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
          this.updatePrev();
        }

        updatePrev() {
          this.prevPos.x = this.pos.x;
          this.prevPos.y = this.pos.y;
        }

        edges() {
          if (this.pos.x > p.width) {
            this.pos.x = 0;
            this.updatePrev();
          }
          if (this.pos.x < 0) {
            this.pos.x = p.width;
            this.updatePrev();
          }
          if (this.pos.y > p.height) {
            this.pos.y = 0;
            this.updatePrev();
          }
          if (this.pos.y < 0) {
            this.pos.y = p.height;
            this.updatePrev();
          }
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(canvasRef.current);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        p.background(0, 0, 10);

        // Calculate flow field dimensions
        cols = p.floor(p.width / scale);
        rows = p.floor(p.height / scale);

        // Initialize particles
        for (let i = 0; i < 300; i++) {
          particles.push(new Particle());
        }

        // Initialize flow field
        flowField = new Array(cols * rows);
      };

      p.draw = () => {
        // Fade effect instead of clearing
        p.background(0, 0, 10, 2);

        // Smoothly interpolate visual parameters
        currentHue = p.lerp(currentHue, targetHue, 0.05);
        currentSaturation = p.lerp(currentSaturation, targetSaturation, 0.05);
        currentSpeed = p.lerp(currentSpeed, targetSpeed, 0.02);
        currentIntensity = p.lerp(currentIntensity, targetIntensity, 0.03);

        // Generate Perlin noise flow field
        let yoff = 0;
        for (let y = 0; y < rows; y++) {
          let xoff = 0;
          for (let x = 0; x < cols; x++) {
            let index = x + y * cols;
            let angle = p.noise(xoff, yoff, zoff) * p.TWO_PI * 4;
            let v = p5.Vector.fromAngle(angle);
            v.setMag(0.5);
            flowField[index] = v;
            xoff += 0.1;
          }
          yoff += 0.1;
        }
        zoff += currentSpeed;

        // Update and draw particles
        for (let particle of particles) {
          particle.follow(flowField);
          particle.update();
          particle.edges();
          particle.show();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        cols = p.floor(p.width / scale);
        rows = p.floor(p.height / scale);
        flowField = new Array(cols * rows);
      };

      // Function to update visual parameters based on sentiment
      p.updateSentiment = (newSentiment, score, newEmotions) => {
        console.log('Updating visualization:', newSentiment, score, newEmotions);

        // Map sentiment to color (hue)
        if (newSentiment === 'positive') {
          targetHue = 50; // Yellow/Orange (warm, happy)
          targetSaturation = 80;
          targetSpeed = 0.008; // Faster, more energetic
          targetIntensity = 1.5;
        } else if (newSentiment === 'negative') {
          targetHue = 240; // Blue/Purple (cool, sad)
          targetSaturation = 70;
          targetSpeed = 0.003; // Slower, more subdued
          targetIntensity = 0.7;
        } else {
          targetHue = 200; // Cyan (neutral)
          targetSaturation = 50;
          targetSpeed = 0.005; // Medium
          targetIntensity = 1;
        }

        // Adjust intensity based on sentiment score
        // Score close to 0 or 1 = strong emotion = more intensity
        let scoreIntensity = Math.abs(score - 0.5) * 2; // 0 to 1
        targetIntensity *= (0.5 + scoreIntensity);

        // Add more particles for stronger emotions
        let targetParticleCount = Math.floor(200 + scoreIntensity * 300);
        while (particles.length < targetParticleCount) {
          particles.push(new Particle());
        }
        while (particles.length > targetParticleCount) {
          particles.pop();
        }
      };
    };

    // Create the p5 instance
    p5InstanceRef.current = new p5(sketch);

    // Cleanup
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, []);

  // Update visualization when sentiment changes
  useEffect(() => {
    if (p5InstanceRef.current && p5InstanceRef.current.updateSentiment) {
      p5InstanceRef.current.updateSentiment(sentiment, sentimentScore, emotions);
    }
  }, [sentiment, sentimentScore, emotions]);

  return (
    <div 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1
      }}
    />
  );
};

export default PerlinAura;