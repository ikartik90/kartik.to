// Every recipe, registered for panda.config.ts. Order is cascade order: at equal specificity a
// later recipe beats an earlier one, so reordering changes which rule wins.

import { demoFrame, demoFrameDemoArea } from "../../demo-frame.recipe";
import {
  demoLoggerPanel,
  demoLoggerHeader,
  demoLoggerBody,
  demoLoggerLine,
} from "../../demo-logger.recipe";
import { uploadBody } from "../../image-insert-dialog.recipe";
import { linkCard } from "../../link-card.recipe";
import { toolbarSwatch } from "../../link-toolbar.recipe";
import { mediaTransport } from "../../media-transport.recipe";
import { sidenoteCard } from "../../sidenote-layer.recipe";
import { weatherGraphic } from "../../weather-graphic.recipe";
import { weatherWidget } from "../../weather-widget.recipe";
import { calendar } from "../input/calendar.recipe";
import { checkboxField } from "../input/checkbox.recipe";
import { colorField } from "../input/color-input.recipe";
import { colorPicker } from "../input/color-picker.recipe";
import { imageField } from "../input/image-input.recipe";
import { optionList } from "../input/option-list.recipe";
import { sliderField } from "../input/slider.recipe";
import { switchField } from "../input/switch.recipe";
import { notice } from "../notice.recipe";
import { wireframe, skeleton } from "../wireframe.recipe";
import { action } from "./action";
import {
  inlineCode,
  articleLink,
  articleUnderline,
  articleStrikethrough,
  articleHighlight,
  articleSidenote,
  articleSidenoteText,
  articleSidenoteRef,
  codeBlock,
  articleShowcase,
  articleBlockquoteShell,
  articleBlockquoteMark,
  articleBlockquote,
  articleHeadingShell,
  articleSubheadingCaption,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleListItemShell,
  listMarkerBox,
  listMarker,
  listBullet,
  listBulletIcon,
  listBulletCircle,
  articleListItemContent,
  articleMetric,
  articleMetricCaption,
  articleMetricValue,
  articleMetricLabel,
  horizontalRule,
} from "./article";
import { collectionGrid } from "./collection-grid";
import { colorPickerPopover } from "./color-picker-popover";
import { comboboxPopover } from "./combobox-popover";
import { commandHeader, commandList, commandGroup } from "./command";
import { dialogPanel, dialogHeader, dialogTitle, dialogFooter } from "./dialog";
import { field } from "./field";
import { hotkey } from "./hotkey";
import { inlineEditRow } from "./inline-edit-row";
import { mediaBlock } from "./media-block";
import {
  libraryBody,
  mediaLibrarySidebar,
  mediaPreviewPane,
} from "./media-library";
import { mediaObjectToolbar } from "./media-object-toolbar";
import { menuIcon } from "./menu-icon";
import { menuItem } from "./menu-item";
import { propertiesPanel } from "./properties-panel";
import { segmentedControl } from "./segmented-control";
import { selectionPopover } from "./selection-popover";
import { testimonialCard } from "./testimonial-card";
import { toolbar } from "./toolbar";
import { tooltip, tooltipIcon } from "./tooltip";

export const recipes = {
  wireframe,
  action,
  inlineCode,
  articleLink,
  articleUnderline,
  articleStrikethrough,
  articleHighlight,
  articleSidenote,
  articleSidenoteText,
  articleSidenoteRef,
  sidenoteCard,
  codeBlock,
  articleShowcase,
  demoFrame,
  demoFrameDemoArea,
  demoLoggerPanel,
  demoLoggerHeader,
  demoLoggerBody,
  demoLoggerLine,
  mediaTransport,
  dialogPanel,
  dialogHeader,
  dialogTitle,
  libraryBody,
  dialogFooter,
  uploadBody,
  mediaLibrarySidebar,
  mediaPreviewPane,
  articleBlockquoteShell,
  articleBlockquoteMark,
  articleBlockquote,
  articleHeadingShell,
  articleSubheadingCaption,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleListItemShell,
  listMarkerBox,
  listMarker,
  listBullet,
  listBulletIcon,
  listBulletCircle,
  articleListItemContent,
  articleMetric,
  articleMetricCaption,
  articleMetricValue,
  articleMetricLabel,
  horizontalRule,
  comboboxPopover,
  colorPickerPopover,
  toolbar,
  toolbarSwatch,
  selectionPopover,
  tooltip,
  hotkey,
  tooltipIcon,
  menuIcon,
  menuItem,
  commandHeader,
  commandList,
  commandGroup,
  mediaObjectToolbar,
};

export const slotRecipes = {
  skeleton,
  field,
  switchField,
  checkboxField,
  sliderField,
  calendar,
  inlineEditRow,
  mediaBlock,
  collectionGrid,
  colorField,
  imageField,
  colorPicker,
  propertiesPanel,
  optionList,
  segmentedControl,
  notice,
  linkCard,
  weatherGraphic,
  weatherWidget,
  testimonialCard,
};
