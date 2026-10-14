import { Fragment, type SVGProps } from "react";
import { iconAttrsToProps, resolveIconNodes, type IconNode, type IconSettings, type IconSvg } from "@/utils/icon-svg";

function IconNodes({ nodes }: { nodes: IconNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const Tag = node.tag as "path";
        const props = iconAttrsToProps(node.attrs);
        return (
          <Fragment key={index}>
            {node.children.length === 0 ? (
              <Tag {...props} />
            ) : (
              <Tag {...props}>
                <IconNodes nodes={node.children} />
              </Tag>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

type IconDrawingProps = Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox"> & {
  svg: IconSvg;
  /** The line weight it's drawn at, and its size unless `size` says otherwise. */
  settings: IconSettings;
  size?: number;
};

/** An icon from the set, drawn in the current colour. Decorative: whatever shows it names it. */
export function IconDrawing({ svg, settings, size = settings.size, ...props }: IconDrawingProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${svg.viewBox} ${svg.viewBox}`} fill="none" aria-hidden {...props}>
      <IconNodes nodes={resolveIconNodes(svg, settings)} />
    </svg>
  );
}
