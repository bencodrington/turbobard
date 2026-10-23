# Turbobard

Turbobard is a browser-based tabletop RPG audio mixer. This glossary defines the product language for rebuilding the legacy application while preserving its user-visible behavior.

## Product concepts

**Environment**:
A user-created collection of sounds configured for a tabletop scene.
_Avoid_: Group

**Sound**:
An audio item placed in an environment; it is either a Loop or a One-shot and is assigned to Ambiance or Combat placement.
_Avoid_: Track (legacy implementation term)

**Loop**:
A sound that continues playing until it is stopped or replaced, with seamless repetition intended for ongoing music or ambiance.

**One-shot**:
A sound with one or more short variations that are selected and played individually at a configured interval.
_Avoid_: Oneshoot, one shot (when naming the domain concept)

**Ambiance**:
The ordinary sound placement in an environment, including music and background effects.

**Combat mode**:
The playback state in which Combat music replaces ordinary music and Combat ambiance is added to ordinary ambiance.

**Combat**:
The sound placement used for sounds that participate in Combat mode.

**Sound catalog**:
The external searchable source of available sounds and their metadata.

**Icon catalog**:
The external searchable source of icons that can represent an Environment.

## Engineering terms

**PWA**:

A web application that can provide an app-like experience through browser capabilities such as installation, offline behavior, and background capabilities. This term describes a product capability, not a commitment that every capability is present.

**Unit test**:

A fast, isolated test of a small piece of application behavior, such as a function or component interaction, without relying on a real browser or external service.

**E2E test**:

An end-to-end test that exercises the application through a real browser across a user-visible workflow.

**Verification**:

The repeatable set of checks that establishes whether a change is ready to share: formatting, linting, typechecking, unit tests, production build, and browser tests.
