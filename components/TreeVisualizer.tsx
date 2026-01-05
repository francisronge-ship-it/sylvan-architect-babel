
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { SyntaxNode } from '../types';

interface TreeVisualizerProps {
  data: SyntaxNode;
  animated?: boolean;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, animated = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observeTarget = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(observeTarget);
    return () => resizeObserver.unobserve(observeTarget);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width: containerWidth, height: containerHeight } = dimensions;
    const rootHierarchy = d3.hierarchy(data);
    const nodeCount = rootHierarchy.descendants().length;
    const maxDepth = rootHierarchy.height;

    const width = Math.max(containerWidth, nodeCount * 280);
    const height = Math.max(containerHeight, (maxDepth + 1) * 300);
    
    const margin = { top: 120, right: 250, bottom: 250, left: 250 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const treeLayout = d3.tree<SyntaxNode>()
      .size([innerWidth, innerHeight])
      .separation((a, b) => {
        const isHeadPhrasePair = (!!a.data.word !== !!b.data.word);
        if (a.parent === b.parent) {
          return isHeadPhrasePair ? 3.2 : 2.2; 
        }
        return 4.0;
      });

    const treeData = treeLayout(rootHierarchy);
    const branchColor = '#593a0e';

    // RENDER BRANCHES
    const link = g.selectAll('.branch')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'branch')
      .attr('fill', 'none')
      .attr('stroke', branchColor)
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
      .attr('d', d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any
      );

    if (animated) {
      // GROWTH ANIMATION LOGIC (Bottom-Up)
      link.each(function(d: any) {
        const length = (this as SVGPathElement).getTotalLength();
        const depthFromBottom = maxDepth - d.source.depth;
        const delay = depthFromBottom * 800; // Delay based on depth
        
        d3.select(this)
          .attr('stroke-dasharray', `${length} ${length}`)
          .attr('stroke-dashoffset', length)
          .transition()
          .delay(delay)
          .duration(1000)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      });
    }

    const node = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('opacity', animated ? 0 : 1);

    if (animated) {
      node.transition()
        .delay(d => (maxDepth - d.depth) * 800 + 400)
        .duration(800)
        .style('opacity', 1);
    }

    // Phrasal Labels
    const phrasalGroups = node.filter(d => !d.data.word);
    phrasalGroups.append('text')
      .attr('dy', '-0.7em') 
      .attr('text-anchor', 'middle')
      .attr('font-size', '46px') 
      .attr('font-weight', '900')
      .attr('fill', '#ffffff')
      .style('font-family', "'Quicksand', sans-serif")
      .style('paint-order', 'stroke')
      .style('stroke', '#050a08')
      .style('stroke-width', '16px')
      .style('stroke-linecap', 'round')
      .style('stroke-linejoin', 'round')
      .text(d => d.data.label);

    // Terminal Labels
    const terminals = node.filter(d => !!d.data.word);
    terminals.append('text')
      .attr('dy', '0.7em') 
      .attr('text-anchor', 'middle')
      .attr('font-size', '40px') 
      .attr('font-weight', '900')
      .attr('fill', '#ffffff') 
      .style('font-family', "'Quicksand', sans-serif")
      .style('paint-order', 'stroke')
      .style('stroke', '#050a08')
      .style('stroke-width', '12px')
      .text(d => d.data.label);

    terminals.append('text')
      .attr('dy', '2.6em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '56px') 
      .attr('font-weight', '700')
      .attr('fill', '#10b981')
      .style('font-family', "'Quicksand', sans-serif")
      .style('font-style', 'italic')
      .style('paint-order', 'stroke')
      .style('stroke', '#050a08')
      .style('stroke-width', '14px')
      .text(d => d.data.word!);

    terminals.append('line')
      .attr('x1', 0)
      .attr('y1', 45)
      .attr('x2', 0)
      .attr('y2', 105) 
      .attr('stroke', branchColor)
      .attr('stroke-width', 5)
      .attr('stroke-dasharray', '12,8')
      .style('opacity', animated ? 0 : 1)
      .transition()
      .delay(d => (maxDepth - d.depth) * 800 + 200)
      .duration(500)
      .style('opacity', 1);

    // Initial Viewport
    const initialScale = Math.min(1, containerWidth / (innerWidth + margin.left + margin.right)) * 0.7;
    const initialX = containerWidth / 2 - (treeData as any).x * initialScale;
    const initialY = 140; 
    
    svg.call(zoom.transform as any, d3.zoomIdentity
      .translate(initialX, initialY)
      .scale(initialScale));

  }, [data, dimensions, animated]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden border-2 border-white/5 rounded-[3rem] tree-canvas-bg shadow-2xl relative">
      <div className="absolute top-8 left-10 pointer-events-none z-10">
        <div className="text-[12px] font-black text-emerald-500/60 uppercase tracking-[0.6em] flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
          {animated ? 'Syntactic Growth Phase' : 'Linguistic Arboretum'}
        </div>
      </div>
      
      <svg ref={svgRef} className="cursor-grab active:cursor-grabbing w-full h-full block" />
      
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-48 sm:h-64 md:h-80 opacity-100">
          <path d="M0,100 L0,80 C150,55 350,95 500,70 C650,45 800,90 1000,70 L1000,100 Z" fill="#080402" />
          <path d="M0,100 L0,90 C200,80 400,95 600,85 C800,75 900,90 1000,85 L1000,100 Z" fill="#140a05" />
        </svg>
      </div>

      <div className="absolute bottom-8 right-10 hidden md:flex items-center gap-3 px-5 py-2 rounded-full bg-black/40 border border-white/10 text-[10px] font-black text-emerald-500/40 uppercase tracking-widest shadow-xl backdrop-blur-md">
        {animated ? 'Simulating Bottom-Up Merge' : 'Balanced Sylvan Render'}
      </div>
    </div>
  );
};

export default TreeVisualizer;
