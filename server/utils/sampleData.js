const sampleNotebooks = {
  quantum: {
    title: "Quantum Computing & Post-Quantum Encryption",
    description: "Research papers on superconducting qubits, Shor's algorithm, and quantum supremacy.",
    documents: [
      {
        filename: "quantum_supremacy_primer.txt",
        text: `Quantum Computing Fundamentals & Superconducting Qubits
Abstract:
Quantum computing leverages quantum mechanical phenomena such as superposition and entanglement to perform calculations exponentially faster than classical supercomputers for specific problem domains. Unlike classical bits that exist strictly in state 0 or 1, quantum bits (qubits) exist as continuous state vectors on the Bloch sphere, represented mathematically as |Ψ⟩ = α|0⟩ + β|1⟩ where |α|² + |β|² = 1.

Key Architecture and Superconducting Circuits:
Leading physical implementations utilize superconducting transmon qubits fabricated from aluminum Josephson junctions cooled to cryogenic temperatures (~15 millikelvin) inside dilution refrigerators. Transmon qubits isolate non-linear energy levels to control quantum states using microwave pulses at ~5 GHz frequencies.

Shor's Algorithm & Modern Cryptography:
Peter Shor's 1994 algorithm demonstrated that a fault-tolerant quantum computer equipped with ~4,000 logical qubits could factor RSA-2048 encryption keys in mere hours using Quantum Fourier Transform (QFT). Classical supercomputers would require thousands of years using the General Number Field Sieve (GNFS).

Post-Quantum Cryptography (PQC):
To combat potential decryption by future quantum adversaries (often called "store now, decrypt later" attacks), the National Institute of Standards and Technology (NIST) selected lattice-based cryptography standards, specifically CRYSTALS-Kyber for key encapsulation and CRYSTALS-Dilithium for digital signatures. Lattice problems (such as Learning With Errors, LWE) remain computationally intractable for both classical and quantum algorithms.`,
      },
      {
        filename: "error_correction_surface_codes.txt",
        text: `Quantum Error Correction & Logical Qubits
The Challenge of Quantum Noise:
Physical qubits are highly susceptible to environmental decoherence, thermal fluctuations, and crosstalk errors. Single-qubit relaxation times (T1) and dephasing times (T2) typically range from 50 to 150 microseconds in modern transmon processors.

Surface Codes & Fault Tolerance:
Fault-tolerant quantum computing requires quantum error correction (QEC). The 2D planar surface code is currently the most promising architecture, requiring a 2D lattice of physical qubits where data qubits alternate with syndrome measurement qubits (ancilla qubits). Surface codes can tolerate physical gate error rates up to approximately 1% (the fault-tolerance threshold).

Logical Qubit Overhead:
To produce 1 error-corrected logical qubit with an error rate below 10⁻¹⁵, roughly 1,000 to 10,000 physical qubits are required. Recent experimental milestones from Google Quantum AI and IBM Quantum have demonstrated fault-tolerant suppression of physical errors by increasing code distance from d=3 to d=5.`,
      }
    ]
  },

  neuroscience: {
    title: "AI, Neuroscience & Biological Neural Networks",
    description: "Comparative study of biological brain architectures and artificial neural networks.",
    documents: [
      {
        filename: "biological_vs_artificial_neurons.txt",
        text: `Neuroscience & Artificial Neural Networks: Comparative Analysis
Introduction:
Artificial Neural Networks (ANNs) were originally inspired by biological brains, yet modern deep learning models diverge significantly from biological cortical processing. This document compares synaptic transmission in the human cerebral cortex with gradient-based backpropagation in deep transformers.

Synaptic Plasticity vs Backpropagation:
The human brain contains approximately 86 billion neurons connected by ~100 trillion synapses. Learning occurs locally via Hebbian plasticity ("cells that fire together, wire together") and Spike-Timing-Dependent Plasticity (STDP). In contrast, artificial neural networks rely on global backpropagation through time (BPTT), updating weights via stochastic gradient descent computed from a unified loss function.

Energy Efficiency & Neuromorphic Computing:
The human brain operates on approximately 20 Watts of power—an extraordinary feat of energy efficiency. Conversely, training a 100-billion parameter transformer model requires megawatts of electricity across thousands of GPU clusters. Neuromorphic architectures (such as Intel Loihi and BrainScaleS) attempt to mimic event-driven spiking neural networks (SNNs) to achieve brain-like energy efficiency.`,
      }
    ]
  }
};

module.exports = sampleNotebooks;
