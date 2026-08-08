---
title: "Drawing an Open-Ended Syntax: The Babel Relation Atlas"
---

The original problem with Babel's old relation rendering was that it only knew how to draw movement. I later realised that explicitly prompting for movement while only being able to draw movement was not very theory-neutral. Therefore, when I refactored the entire contract into the open contract it is today, I decided that I also wanted to express all the different kinds of relations the models could express.

Then I ran into a dilemma: if the model can literally write anything inside the open relation, how can Babel "draw" everything using only deterministic code? How could Babel do this without doing linguistics too? It was a headache. I thought about designing a neural layer in between, but I figured it would take too much time and would not end up looking quite how I wanted it to.

So I started the journey of drawing relation UI for every major syntactic family, as well as some more obscure but important relations. I designed a workflow for this. I would have the model research and find visual references for the relation we were going to portray in Babel. Then I would go through them, learning what the relation even was or meant at the same time. I got multiple headaches doing this. I would think about whether they worked as general examples and whether they fit Babel's UI and contract. Once I had decided which sources to copy, I would have the model draw them inside the HTML lab.

Interestingly enough, GPT-5.5, and primarily GPT-5.6 Sol, were the best at this, even though they generally suck at UI. My thought is that this was due to GPT models being very straightforward and doing exactly what you tell them. Fable also did very well, of course, although I could not justify using much of Fable for this. Opus 5 got very confused and produced bad results, which also surprised me.

Doing this was actual hell, though, and I will say that the models are not very pleasant for this kind of work yet. They are not perfect at the research work or the design implementation work. I hope that changes soon.

I have moved all the relations out of the lab, and I am archiving and keeping it as a record of the work I did. I have also designed the renderer pipeline with Fable, and I am very excited to get things rolling again. I have a lot of work ahead of me, but it is finally time to stop drawing syntactic relations and start working on the new Babel.

What frustrates me is that I still do not feel finished with this, and I do not think I ever will. First of all, I am not a syntax genius. I still have lots to learn, and all of this confuses me a lot. I may not have done a perfect job, and I certainly did not cover all the relations in the world of syntax, even though part of me wanted to. That is impossible.

So I would appreciate anyone who wants to continue working on this with me and expanding the library of syntactic relations. The purpose of the relation UI was, first and foremost, to create an awesome way to learn syntax visually. D3 and SVG are extremely good for this kind of thing and are much more expressive than the current tools available, such as Mshang.

If anyone does want to contribute, an issue or PR containing a relation, an example tree showing that relation, the code, and an explanation of how it would map to Babel and its current contract would be sick.
