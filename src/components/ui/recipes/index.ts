// Every recipe, registered for panda.config.ts. A recipe used by one component
// lives beside it as `<component>.recipe.ts`; one used by two or more lives in
// this folder (see recipe-placement.test.ts).
//
// ORDER HERE IS CASCADE ORDER. Panda emits recipes in the order they are
// registered, so at equal specificity a recipe listed later beats one listed
// earlier. The order below is the one panda.config.ts had when the recipes
// moved out of it; changing it changes which rule wins wherever two recipes
// meet on one element.

import { articleList } from "../../article-renderer.recipe";
import { collectionEmptyCell } from "../../collection-grid.recipe";
import { demoPreloader } from "../../demo-component.recipe";
import {
  demoFrame,
  demoFrameDemoArea,
  demoFrameDemoMeasure,
} from "../../demo-frame.recipe";
import {
  demoLoggerSection,
  demoLoggerPanel,
  demoLoggerHeader,
  demoLoggerBody,
  demoLoggerLine,
} from "../../demo-logger.recipe";
import { demoFrameControls } from "../../demo/demo-controls.recipe";
import { masonryGrid } from "../../home-grid.recipe";
import {
  dialogFooterGroup,
  uploadBodySlot,
  uploadBody,
  mediaPreview,
  mediaMetadataRow,
  mediaAltRow,
  mediaDeleteRow,
  mediaThumbnail,
} from "../../image-insert-dialog.recipe";
import { linkCard } from "../../link-card.recipe";
import { toolbarSwatch } from "../../link-toolbar.recipe";
import { mediaLightbox } from "../../media-lightbox.recipe";
import { mediaTransport } from "../../media-transport.recipe";
import {
  sidenoteCard,
  sidenoteCardContent,
  sidenoteCardMarker,
  sidenoteCardBody,
} from "../../sidenote-layer.recipe";
import { slashMenuPopover } from "../../slash-menu.recipe";
import { weatherGraphic } from "../../weather-graphic.recipe";
import { weatherWidget } from "../../weather-widget.recipe";
import { calendar } from "../input/calendar.recipe";
import { checkboxField } from "../input/checkbox.recipe";
import { colorField } from "../input/color-input.recipe";
import { colorPicker } from "../input/color-picker.recipe";
import { colorSwatchGrid } from "../input/color-swatch-grid.recipe";
import { datePopover } from "../input/datepicker.recipe";
import { imageField } from "../input/image-input.recipe";
import { optionList } from "../input/option-list.recipe";
import { sliderField } from "../input/slider.recipe";
import { switchField } from "../input/switch.recipe";
import { timePopover, timePicker } from "../input/time-picker.recipe";
import { notice } from "../notice.recipe";
import { uploadProgress, progressBarFill } from "../progress-bar.recipe";
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
  masonryGrid,
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
  sidenoteCardContent,
  sidenoteCardMarker,
  sidenoteCardBody,
  codeBlock,
  articleShowcase,
  demoFrame,
  demoFrameDemoArea,
  demoFrameDemoMeasure,
  demoFrameControls,
  demoLoggerSection,
  demoLoggerPanel,
  demoLoggerHeader,
  demoLoggerBody,
  demoLoggerLine,
  mediaTransport,
  collectionEmptyCell,
  dialogPanel,
  dialogHeader,
  dialogTitle,
  libraryBody,
  dialogFooter,
  dialogFooterGroup,
  uploadBodySlot,
  uploadBody,
  uploadProgress,
  progressBarFill,
  demoPreloader,
  mediaLibrarySidebar,
  mediaPreview,
  mediaPreviewPane,
  mediaMetadataRow,
  mediaAltRow,
  mediaDeleteRow,
  mediaThumbnail,
  articleBlockquoteShell,
  articleBlockquoteMark,
  articleBlockquote,
  articleHeadingShell,
  articleSubheadingCaption,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleList,
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
  slashMenuPopover,
  datePopover,
  comboboxPopover,
  timePopover,
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
  colorSwatchGrid,
  colorPicker,
  propertiesPanel,
  mediaLightbox,
  optionList,
  timePicker,
  segmentedControl,
  notice,
  linkCard,
  weatherGraphic,
  weatherWidget,
  testimonialCard,
};
